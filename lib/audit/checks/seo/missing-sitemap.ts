import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingSitemap: AuditCheckDefinition = {
  name: 'missing_sitemap',
  type: 'seo',
  priority: 'critical',
  description: 'XML sitemap helps search engines discover and index pages',
  displayName: 'Missing XML Sitemap',
  displayNamePassed: 'XML Sitemap',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url).origin

    // Try to fetch sitemap.xml
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
    ]

    let sitemapFound = false
    let sitemapUrl = ''
    let sitemapError = ''

    for (const url of sitemapUrls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        })

        if (response.ok) {
          sitemapFound = true
          sitemapUrl = url
          break
        }
      } catch {
        // Continue to next URL
      }
    }

    // Also check robots.txt for Sitemap directive
    let robotsSitemapUrl = ''
    try {
      const robotsResponse = await fetch(`${baseUrl}/robots.txt`, {
        signal: AbortSignal.timeout(5000),
      })

      if (robotsResponse.ok) {
        const robotsText = await robotsResponse.text()
        const sitemapMatch = robotsText.match(/^Sitemap:\s*(.+)$/im)
        if (sitemapMatch) {
          robotsSitemapUrl = sitemapMatch[1].trim()

          // Verify the sitemap URL from robots.txt works
          if (!sitemapFound) {
            try {
              const sitemapResponse = await fetch(robotsSitemapUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
              })
              if (sitemapResponse.ok) {
                sitemapFound = true
                sitemapUrl = robotsSitemapUrl
              }
            } catch {
              sitemapError = `Sitemap declared in robots.txt (${robotsSitemapUrl}) but not accessible`
            }
          }
        }
      }
    } catch {
      // robots.txt not accessible, continue
    }

    if (sitemapFound) {
      return {
        status: 'passed',
        details: {
          message: `XML sitemap found at ${sitemapUrl}`,
          sitemap_url: sitemapUrl,
        },
      }
    }

    if (sitemapError) {
      return {
        status: 'warning',
        details: {
          message: sitemapError,
        },
      }
    }

    return {
      status: 'failed',
      details: {
        message:
          'No XML sitemap found. Create a sitemap.xml file listing all important pages to help search engines discover your content. Most CMS platforms can generate this automatically.',
      },
    }
  },
}
