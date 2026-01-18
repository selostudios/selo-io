import { fetchPage, extractLinks } from './fetcher'
import type { SiteAuditPage } from './types'

export interface CrawlOptions {
  maxPages: number
  onPageCrawled?: (page: SiteAuditPage) => void
}

export interface CrawlResult {
  pages: SiteAuditPage[]
  errors: string[]
}

export async function crawlSite(
  startUrl: string,
  auditId: string,
  options: CrawlOptions
): Promise<CrawlResult> {
  const { maxPages = 200, onPageCrawled } = options
  const visited = new Set<string>()
  const queue: string[] = [normalizeUrl(startUrl)]
  const pages: SiteAuditPage[] = []
  const errors: string[] = []

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!

    if (visited.has(url)) continue
    visited.add(url)

    const { html, statusCode, error } = await fetchPage(url)

    if (error) {
      errors.push(`Failed to fetch ${url}: ${error}`)
      continue
    }

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    const page: SiteAuditPage = {
      id: crypto.randomUUID(),
      audit_id: auditId,
      url,
      title,
      status_code: statusCode,
      crawled_at: new Date().toISOString(),
    }

    pages.push(page)
    onPageCrawled?.(page)

    // Extract and queue new links
    if (statusCode === 200) {
      const links = extractLinks(html, url)
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link)
        }
      }
    }

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { pages, errors }
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href.replace(/\/$/, '')
}
