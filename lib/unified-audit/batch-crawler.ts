import { createServiceClient } from '@/lib/supabase/server'
import { fetchPage, extractLinks } from '@/lib/audit/fetcher'
import { pageSpecificChecks } from './checks'
import { UnifiedAuditStatus } from '@/lib/enums'
import type { AuditPage, AuditCheck, CheckContext } from './types'

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

interface DismissedCheck {
  id: string
  organization_id: string
  check_name: string
  url: string
  dismissed_by: string
  created_at: string
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

/**
 * Returns true if a page should have checks run on it.
 * Excludes error pages (4xx/5xx) and soft 404s.
 */
function isCheckablePage(page: Pick<AuditPage, 'status_code' | 'title'>): boolean {
  const status = page.status_code ?? 200
  if (status >= 400) return false

  // Detect soft 404s
  const soft404Patterns = [/\b404\b/i, /page\s+not\s+found/i, /not\s+found/i]
  if (status === 200 && page.title && soft404Patterns.some((p) => p.test(page.title!))) {
    return false
  }

  return true
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

  await supabase.from('audit_crawl_queue').upsert(
    {
      audit_id: auditId,
      url: normalizedUrl,
      depth: 0,
    },
    { onConflict: 'audit_id,url' }
  )

  // Update urls_discovered count
  await supabase.from('audits').update({ urls_discovered: 1 }).eq('id', auditId)
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

  // Get all already-crawled pages for context (needed for page-specific checks)
  const { data: existingPages } = await supabase
    .from('audit_pages')
    .select(
      'url, title, meta_description, status_code, last_modified, is_resource, resource_type, depth'
    )
    .eq('audit_id', auditId)

  const allPages: AuditPage[] = (existingPages as AuditPage[]) || []

  while (pagesProcessed < BATCH_SIZE) {
    // Check time budget
    if (Date.now() - startTime > MAX_BATCH_DURATION_MS) {
      console.log(`[Batch Crawler] Time budget exceeded after ${pagesProcessed} pages`)
      break
    }

    // Check for stop signal
    const { data: auditStatus } = await supabase
      .from('audits')
      .select('status')
      .eq('id', auditId)
      .single()

    if (auditStatus?.status === UnifiedAuditStatus.Stopped) {
      stopped = true
      break
    }

    // Get next URL from queue (pending items ordered by depth then creation time)
    const { data: queueItem } = await supabase
      .from('audit_crawl_queue')
      .select('id, url, depth')
      .eq('audit_id', auditId)
      .eq('status', 'pending')
      .order('depth', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!queueItem) {
      // No more URLs to crawl
      break
    }

    const url = queueItem.url

    // Mark as crawled immediately to prevent duplicate processing
    await supabase.from('audit_crawl_queue').update({ status: 'crawled' }).eq('id', queueItem.id)

    // Fetch the page (with retry logic for the seed URL)
    const isSeedUrl = allPages.length === 0 && pagesProcessed === 0
    let html = ''
    let statusCode = 0
    let lastModified: string | null = null
    let finalUrl: string | undefined

    if (isSeedUrl) {
      let succeeded = false
      let lastError: string | undefined

      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await fetchPage(url)
        html = result.html
        statusCode = result.statusCode
        lastModified = result.lastModified
        finalUrl = result.finalUrl
        lastError = result.error

        if (result.error) {
          console.log(`[Batch Crawler] Seed URL attempt ${attempt}/3 failed: ${result.error}`)
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }

        if (statusCode === 403) {
          console.log(`[Batch Crawler] Seed URL attempt ${attempt}/3 returned 403`)
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }

        succeeded = true
        break
      }

      if (!succeeded) {
        const reason =
          statusCode! === 403
            ? 'Website blocked our crawler (HTTP 403). The site may have a firewall that blocks automated requests.'
            : lastError || `The website returned HTTP ${statusCode!}`

        // Update audit with error and mark as failed
        await supabase
          .from('audits')
          .update({
            status: UnifiedAuditStatus.Failed,
            error_message: reason,
            completed_at: new Date().toISOString(),
          })
          .eq('id', auditId)

        return { pagesProcessed: 0, hasMorePages: false, stopped: false }
      }
    } else {
      const result = await fetchPage(url)
      html = result.html
      statusCode = result.statusCode
      lastModified = result.lastModified
      finalUrl = result.finalUrl

      if (result.error) {
        console.error(`[Batch Crawler] Failed to fetch ${url}: ${result.error}`)
        continue
      }
    }

    // Detect redirects to a different path
    let wasRedirected = false
    if (finalUrl) {
      try {
        const originalPath = new URL(url).pathname.replace(/\/+$/, '')
        const finalPath = new URL(finalUrl).pathname.replace(/\/+$/, '')
        if (originalPath !== finalPath) {
          wasRedirected = true
          console.log(`[Batch Crawler] ${url} redirected to ${finalUrl}`)
        }
      } catch {
        // If URL parsing fails, continue with the page
      }
    }

    // Always extract and queue links (even from redirected pages) to ensure crawl discovery
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
        // Upsert to handle duplicates gracefully (unique constraint on audit_id, url)
        await supabase
          .from('audit_crawl_queue')
          .upsert(newUrls, { onConflict: 'audit_id,url', ignoreDuplicates: true })

        // Update urls_discovered count
        const { count } = await supabase
          .from('audit_crawl_queue')
          .select('*', { count: 'exact', head: true })
          .eq('audit_id', auditId)

        await supabase
          .from('audits')
          .update({ urls_discovered: count || 0 })
          .eq('id', auditId)
      }
    }

    // Skip creating page record and running checks for redirected pages
    if (wasRedirected) {
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
    const page: AuditPage = {
      id: crypto.randomUUID(),
      audit_id: auditId,
      url,
      title,
      meta_description: metaDescription,
      status_code: statusCode,
      last_modified: lastModified,
      is_resource: isResource,
      resource_type: resourceType,
      depth: queueItem.depth,
      created_at: new Date().toISOString(),
    }

    // Insert page into database
    await supabase.from('audit_pages').insert(page)
    allPages.push(page)
    pagesProcessed++

    // Run page-specific checks (skip for resources and error pages)
    if (!isResource && isCheckablePage(page)) {
      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title ?? undefined,
        statusCode: page.status_code ?? 200,
        allPages: allPages.map((p) => ({
          url: p.url,
          title: p.title,
          statusCode: p.status_code,
          metaDescription: p.meta_description,
          isResource: p.is_resource,
        })),
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
            page_url: page.url,
            category: check.category,
            check_name: check.name,
            priority: check.priority,
            status: result.status as AuditCheck['status'],
            display_name: check.displayName,
            display_name_passed: check.displayNamePassed ?? check.displayName,
            description: check.description,
            fix_guidance: check.fixGuidance ?? (result.details?.message as string) ?? null,
            learn_more_url: check.learnMoreUrl ?? null,
            details: result.details ?? null,
            feeds_scores: check.feedsScores,
            created_at: new Date().toISOString(),
          } as AuditCheck
        } catch (err) {
          console.error(`[Batch Crawler] Check ${check.name} failed:`, err)
          return null
        }
      })

      const pageCheckResults = (await Promise.all(checkPromises)).filter(
        (r): r is AuditCheck => r !== null
      )

      if (pageCheckResults.length > 0) {
        await supabase.from('audit_checks').insert(pageCheckResults)
      }
    }

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Update pages_crawled count once at end of batch
  if (pagesProcessed > 0) {
    await supabase
      .from('audits')
      .update({
        pages_crawled: allPages.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  }

  // Check if there are more pages remaining
  const { count: remaining } = await supabase
    .from('audit_crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', auditId)
    .eq('status', 'pending')

  return {
    pagesProcessed,
    hasMorePages: (remaining || 0) > 0,
    stopped,
  }
}
