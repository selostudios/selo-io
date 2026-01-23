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
  onPageCrawled?: (page: SiteAuditPage) => void | Promise<void>
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

    const { html, statusCode, lastModified, finalUrl, error } = await fetchPage(url)

    if (error) {
      errors.push(`Failed to fetch ${url}: ${error}`)
      continue
    }

    // Check if this is a resource file (PDF, DOC, etc.)
    const { isResource, resourceType } = getResourceType(url)

    // Extract title from HTML (only for non-resources)
    let title: string | null = null
    if (!isResource) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      title = titleMatch ? titleMatch[1].trim() : null
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
      status_code: statusCode,
      last_modified: lastModified,
      crawled_at: new Date().toISOString(),
      is_resource: isResource,
      resource_type: resourceType,
    }

    pages.push(page)
    await onPageCrawled?.(page)

    // Extract and queue new links (only from HTML pages, not resources)
    if (statusCode === 200 && !isResource) {
      const links = extractLinks(html, url, finalUrl)
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link)
        }
      }
    }

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { pages, errors, stopped }
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href.replace(/\/$/, '')
}
