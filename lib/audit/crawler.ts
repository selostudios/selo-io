import { fetchPage, extractLinks } from './fetcher'
import type { SiteAuditPage } from './types'

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

export interface CrawlOptions {
  maxPages?: number
  onPageCrawled?: (page: SiteAuditPage, html: string) => void | Promise<void>
  shouldStop?: () => Promise<boolean>
}

export interface CrawlResult {
  pages: SiteAuditPage[]
  errors: string[]
  stopped: boolean
}

export async function crawlSite(
  startUrl: string,
  auditId: string,
  options: CrawlOptions
): Promise<CrawlResult> {
  const { maxPages, onPageCrawled, shouldStop } = options
  const visited = new Set<string>()
  const queue: string[] = [normalizeUrl(startUrl)]
  const pages: SiteAuditPage[] = []
  const errors: string[] = []
  let stopped = false

  // SSL certs are domain-level, so switch to relaxed mode after first SSL error
  let forceRelaxedSSL = false

  while (queue.length > 0 && (maxPages === undefined || pages.length < maxPages)) {
    // Check for stop signal every page (responsive to user stop requests)
    if (shouldStop && pages.length > 0) {
      if (await shouldStop()) {
        stopped = true
        break
      }
    }

    const url = queue.shift()!

    if (visited.has(url)) continue
    visited.add(url)

    const isSeedUrl = pages.length === 0 && visited.size === 1

    let html = ''
    let statusCode = 0
    let lastModified: string | null = null
    let finalUrl: string | undefined
    let usedRelaxedSSL: boolean | undefined

    // Retry logic for the seed URL — if the first page fails, the whole audit fails
    if (isSeedUrl) {
      let lastError: string | undefined
      let succeeded = false

      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await fetchPage(url, { forceRelaxedSSL })
        html = result.html
        statusCode = result.statusCode
        lastModified = result.lastModified
        finalUrl = result.finalUrl
        usedRelaxedSSL = result.usedRelaxedSSL
        lastError = result.error

        if (result.error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Audit Crawler] Seed URL attempt ${attempt}/3 failed: ${result.error}`)
          }
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }

        if (statusCode === 403) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Audit Crawler] Seed URL attempt ${attempt}/3 returned 403`)
          }
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
            : lastError
              ? `Failed to fetch ${url}: ${lastError}`
              : `The website returned HTTP ${statusCode!}. Unable to crawl.`
        errors.push(reason)
        break
      }
    } else {
      const result = await fetchPage(url, { forceRelaxedSSL })
      html = result.html
      statusCode = result.statusCode
      lastModified = result.lastModified
      finalUrl = result.finalUrl
      usedRelaxedSSL = result.usedRelaxedSSL

      if (result.error) {
        errors.push(`Failed to fetch ${url}: ${result.error}`)
        continue
      }
    }

    // SSL certs are at domain level - if one page needs relaxed SSL, all will
    if (usedRelaxedSSL && !forceRelaxedSSL) {
      console.error('[Audit Crawler]', {
        type: 'ssl_relaxed_mode_enabled',
        url,
        timestamp: new Date().toISOString(),
      })
      forceRelaxedSSL = true
    }

    // Detect redirects to a different path
    let wasRedirected = false
    if (finalUrl) {
      try {
        const originalPath = new URL(url).pathname.replace(/\/+$/, '')
        const finalPath = new URL(finalUrl).pathname.replace(/\/+$/, '')
        if (originalPath !== finalPath) {
          wasRedirected = true
        }
      } catch {
        // If URL parsing fails, continue with the page
      }
    }

    // Always extract links from redirected pages before skipping
    if (wasRedirected) {
      if (statusCode === 200) {
        const links = extractLinks(html, url, finalUrl)
        if (process.env.NODE_ENV === 'development') {
          console.error(
            `[Audit Crawler] Redirected page ${url} → ${finalUrl}, found ${links.length} links`
          )
        }
        for (const link of links) {
          if (!visited.has(link) && !queue.includes(link)) {
            queue.push(link)
          }
        }
      }
      continue
    }

    // Check if this is a resource file (PDF, DOC, etc.)
    const { isResource, resourceType } = getResourceType(url)

    // Extract title and meta description from HTML (only for non-resources)
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
      // For resources, extract filename as title
      try {
        const pathname = new URL(url).pathname
        const filename = pathname.split('/').pop() || null
        title = filename ? decodeURIComponent(filename) : null
      } catch {
        // Keep title as null
      }
    }

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

    pages.push(page)
    await onPageCrawled?.(page, html)

    // Extract and queue new links (only from HTML pages, not resources)
    if (statusCode === 200 && !isResource) {
      const links = extractLinks(html, url, finalUrl)
      const newLinks = links.filter((l) => !visited.has(l) && !queue.includes(l))
      if (process.env.NODE_ENV === 'development') {
        console.error(
          `[Audit Crawler] Page ${url}: found ${links.length} links, ${newLinks.length} new`
        )
      }
      for (const link of newLinks) {
        queue.push(link)
      }
    }

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.error('[Audit Crawler]', {
    type: 'crawl_finished',
    pagesCount: pages.length,
    visitedCount: visited.size,
    remainingInQueue: queue.length,
    errorsCount: errors.length,
    timestamp: new Date().toISOString(),
  })
  return { pages, errors, stopped }
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href.replace(/\/$/, '')
}
