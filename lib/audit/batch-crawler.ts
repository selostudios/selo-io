import { createServiceClient } from '@/lib/supabase/server'
import { fetchPage, extractLinks } from './fetcher'
import { pageSpecificChecks } from './checks'
import { AuditStatus } from '@/lib/enums'
import type { SiteAuditPage, SiteAuditCheck, CheckContext, DismissedCheck } from './types'

const BATCH_SIZE = 50
const MAX_BATCH_DURATION_MS = 240_000 // 4 minutes (leave 1 min buffer for DB ops)

// Resource file extensions grouped by type
const RESOURCE_EXTENSIONS: Record<string, string[]> = {
  pdf: ['.pdf'],
  document: ['.doc', '.docx', '.odt', '.rtf', '.txt'],
  spreadsheet: ['.xls', '.xlsx', '.csv', '.ods'],
  presentation: ['.ppt', '.pptx', '.odp'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'],
}

function getResourceType(url: string): { isResource: boolean; resourceType: string | null } {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    for (const [type, extensions] of Object.entries(RESOURCE_EXTENSIONS)) {
      if (extensions.some((ext) => pathname.endsWith(ext))) {
        return { isResource: true, resourceType: type }
      }
    }
  } catch {
    // Invalid URL, not a resource
  }
  return { isResource: false, resourceType: null }
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href.replace(/\/$/, '')
}

function isDismissed(dismissedChecks: DismissedCheck[], checkName: string, url: string): boolean {
  return dismissedChecks.some((d) => d.check_name === checkName && d.url === url)
}

export interface BatchResult {
  pagesProcessed: number
  hasMorePages: boolean
  stopped: boolean
}

export interface BatchCrawlOptions {
  dismissedChecks: DismissedCheck[]
}

/**
 * Initialize the crawl queue with the start URL (first batch only)
 */
export async function initializeCrawlQueue(auditId: string, startUrl: string): Promise<void> {
  const supabase = createServiceClient()

  const normalizedUrl = normalizeUrl(startUrl)

  await supabase.from('site_audit_crawl_queue').upsert(
    {
      audit_id: auditId,
      url: normalizedUrl,
      depth: 0,
      discovered_at: new Date().toISOString(),
    },
    { onConflict: 'audit_id,url' }
  )

  // Update urls_discovered count
  await supabase.from('site_audits').update({ urls_discovered: 1 }).eq('id', auditId)
}

/**
 * Crawl a batch of pages from the queue
 * Returns when BATCH_SIZE pages processed or time budget exceeded
 */
export async function crawlBatch(
  auditId: string,
  options: BatchCrawlOptions
): Promise<BatchResult> {
  const supabase = createServiceClient()
  const startTime = Date.now()
  const { dismissedChecks } = options

  let pagesProcessed = 0
  let stopped = false

  // Get audit settings including persisted SSL mode
  const { data: auditSettings } = await supabase
    .from('site_audits')
    .select('use_relaxed_ssl')
    .eq('id', auditId)
    .single()

  let forceRelaxedSSL = auditSettings?.use_relaxed_ssl ?? false

  // Get all already-crawled pages for context (needed for page-specific checks)
  // Only select fields needed by checks (exclude id, audit_id, crawled_at which aren't used)
  const { data: existingPages } = await supabase
    .from('site_audit_pages')
    .select('url, title, meta_description, status_code, last_modified, is_resource, resource_type')
    .eq('audit_id', auditId)

  const allPages: SiteAuditPage[] = (existingPages as SiteAuditPage[]) || []

  while (pagesProcessed < BATCH_SIZE) {
    // Check time budget
    if (Date.now() - startTime > MAX_BATCH_DURATION_MS) {
      console.log(`[Batch Crawler] Time budget exceeded after ${pagesProcessed} pages`)
      break
    }

    // Check for stop signal
    const { data: auditStatus } = await supabase
      .from('site_audits')
      .select('status')
      .eq('id', auditId)
      .single()

    if (auditStatus?.status === AuditStatus.Stopped) {
      stopped = true
      break
    }

    // Get next URL from queue
    const { data: queueItem } = await supabase
      .from('site_audit_crawl_queue')
      .select('id, url, depth')
      .eq('audit_id', auditId)
      .is('crawled_at', null)
      .order('depth', { ascending: true })
      .order('discovered_at', { ascending: true })
      .limit(1)
      .single()

    if (!queueItem) {
      // No more URLs to crawl
      break
    }

    const url = queueItem.url

    // Mark as crawled immediately to prevent duplicate processing
    await supabase
      .from('site_audit_crawl_queue')
      .update({ crawled_at: new Date().toISOString() })
      .eq('id', queueItem.id)

    // Fetch the page
    const { html, statusCode, lastModified, finalUrl, error, usedRelaxedSSL } = await fetchPage(
      url,
      { forceRelaxedSSL }
    )

    if (usedRelaxedSSL && !forceRelaxedSSL) {
      console.log(`[Batch Crawler] SSL certificate issue detected, persisting relaxed SSL mode`)
      forceRelaxedSSL = true
      // Persist for future batches
      await supabase.from('site_audits').update({ use_relaxed_ssl: true }).eq('id', auditId)
    }

    if (error) {
      console.error(`[Batch Crawler] Failed to fetch ${url}: ${error}`)
      continue
    }

    // Determine if resource
    const { isResource, resourceType } = getResourceType(url)

    // Extract title and meta description
    let title: string | null = null
    let metaDescription: string | null = null

    if (!isResource) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      title = titleMatch ? titleMatch[1].trim() : null

      // Extract meta description
      const metaDescMatch = html.match(
        /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
      )
      if (!metaDescMatch) {
        // Try reversed order (content before name)
        const metaDescMatch2 = html.match(
          /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i
        )
        metaDescription = metaDescMatch2 ? metaDescMatch2[1].trim() : null
      } else {
        metaDescription = metaDescMatch[1].trim()
      }
    } else {
      try {
        const pathname = new URL(url).pathname
        const filename = pathname.split('/').pop() || null
        title = filename ? decodeURIComponent(filename) : null
      } catch {
        // Keep title as null
      }
    }

    // Create page record
    const page: SiteAuditPage = {
      id: crypto.randomUUID(),
      audit_id: auditId,
      url,
      title,
      meta_description: metaDescription,
      status_code: statusCode,
      last_modified: lastModified,
      crawled_at: new Date().toISOString(),
      is_resource: isResource,
      resource_type: resourceType,
    }

    // Insert page into database
    await supabase.from('site_audit_pages').insert(page)
    allPages.push(page)
    pagesProcessed++

    // Update pages_crawled count with timestamp
    await supabase
      .from('site_audits')
      .update({
        pages_crawled: allPages.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    // Run page-specific checks (skip for resources)
    if (!isResource) {
      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title,
        statusCode: page.status_code ?? 200,
        allPages, // Incomplete during crawling but page-specific checks don't use it
      }

      const checksToRun = pageSpecificChecks.filter(
        (check) => !isDismissed(dismissedChecks, check.name, page.url)
      )

      const checkPromises = checksToRun.map(async (check) => {
        try {
          const result = await check.run(context)
          return {
            id: crypto.randomUUID(),
            audit_id: auditId,
            page_id: page.id,
            check_type: check.type,
            check_name: check.name,
            priority: check.priority,
            status: result.status,
            details: result.details ?? null,
            created_at: new Date().toISOString(),
            display_name: check.displayName,
            display_name_passed: check.displayNamePassed,
            learn_more_url: check.learnMoreUrl,
            is_site_wide: false,
            description: check.description,
            fix_guidance: check.fixGuidance || (result.details?.message as string) || undefined,
          } as SiteAuditCheck
        } catch (err) {
          console.error(`[Batch Crawler] Check ${check.name} failed:`, err)
          return null
        }
      })

      const pageCheckResults = (await Promise.all(checkPromises)).filter(
        (r): r is SiteAuditCheck => r !== null
      )

      if (pageCheckResults.length > 0) {
        await supabase.from('site_audit_checks').insert(pageCheckResults)
      }

      // Extract and queue new links
      if (statusCode === 200) {
        const links = extractLinks(html, url, finalUrl)
        const newUrls: Array<{ audit_id: string; url: string; depth: number }> = []

        for (const link of links) {
          const normalized = normalizeUrl(link)
          newUrls.push({
            audit_id: auditId,
            url: normalized,
            depth: queueItem.depth + 1,
          })
        }

        if (newUrls.length > 0) {
          // Upsert to handle duplicates gracefully
          await supabase
            .from('site_audit_crawl_queue')
            .upsert(newUrls, { onConflict: 'audit_id,url' })

          // Update urls_discovered count
          const { count } = await supabase
            .from('site_audit_crawl_queue')
            .select('*', { count: 'exact', head: true })
            .eq('audit_id', auditId)

          await supabase
            .from('site_audits')
            .update({ urls_discovered: count || 0 })
            .eq('id', auditId)
        }
      }
    }

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Check if there are more pages remaining
  const { count: remaining } = await supabase
    .from('site_audit_crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', auditId)
    .is('crawled_at', null)

  return {
    pagesProcessed,
    hasMorePages: (remaining || 0) > 0,
    stopped,
  }
}
