import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

const STALE_THRESHOLD_DAYS = 90

export const noRecentUpdates: AuditCheckDefinition = {
  name: 'no_recent_updates',
  type: 'ai_readiness',
  priority: 'recommended',
  description: 'Sites without recent updates may be deprioritized in search',
  displayName: 'No Recent Updates',
  displayNamePassed: 'Content Freshness',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url)
    const now = new Date()
    const thresholdDate = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    // Collect last modified dates from all crawled pages
    const lastModifiedDates: Date[] = []
    for (const page of context.allPages) {
      if (page.last_modified) {
        const date = new Date(page.last_modified)
        if (!isNaN(date.getTime())) {
          lastModifiedDates.push(date)
        }
      }
    }

    // Try to check sitemap.xml for lastmod dates
    let sitemapLastMod: Date | null = null
    try {
      const sitemapUrl = new URL('/sitemap.xml', baseUrl).href
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
      })

      if (response.ok) {
        const xml = await response.text()
        // Extract all lastmod dates from sitemap
        const lastmodMatches = xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)
        for (const match of lastmodMatches) {
          const date = new Date(match[1])
          if (!isNaN(date.getTime())) {
            lastModifiedDates.push(date)
            if (!sitemapLastMod || date > sitemapLastMod) {
              sitemapLastMod = date
            }
          }
        }
      }
    } catch {
      // Sitemap not available or failed to parse
    }

    // Find the most recent update
    const mostRecentDate =
      lastModifiedDates.length > 0 ? lastModifiedDates.reduce((a, b) => (a > b ? a : b)) : null

    if (!mostRecentDate) {
      return {
        status: 'warning',
        details: {
          message:
            'Unable to determine content freshness. No Last-Modified headers or sitemap lastmod dates found. Consider adding timestamps to help search engines assess content relevance.',
        },
      }
    }

    const daysSinceUpdate = Math.floor(
      (now.getTime() - mostRecentDate.getTime()) / (24 * 60 * 60 * 1000)
    )

    if (mostRecentDate < thresholdDate) {
      return {
        status: 'failed',
        details: {
          message: `No content updates in ${daysSinceUpdate} days (threshold: ${STALE_THRESHOLD_DAYS} days). Fresh content signals relevance to search engines and AI systems. Consider updating existing content or publishing new material.`,
          daysSinceUpdate,
          lastUpdate: mostRecentDate.toISOString(),
        },
      }
    }

    return {
      status: 'passed',
      details: {
        message: `Content updated ${daysSinceUpdate} day${daysSinceUpdate === 1 ? '' : 's'} ago`,
        daysSinceUpdate,
        lastUpdate: mostRecentDate.toISOString(),
      },
    }
  },
}
