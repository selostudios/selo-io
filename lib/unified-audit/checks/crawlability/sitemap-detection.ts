import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const sitemapDetection: AuditCheckDefinition = {
  name: 'sitemap_detection',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Critical,
  description: 'XML sitemap helps search engines discover and index pages',
  displayName: 'Missing XML Sitemap',
  displayNamePassed: 'XML Sitemap',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
  isSiteWide: true,
  fixGuidance:
    'Create a sitemap.xml file listing all important pages. Most CMS platforms can generate this automatically. Reference it in your robots.txt with a Sitemap: directive.',
  feedsScores: [ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url).origin

    // Common sitemap paths to check
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
    if (context.robotsTxt) {
      const sitemapMatch = context.robotsTxt.match(/^Sitemap:\s*(.+)$/im)
      if (sitemapMatch) {
        robotsSitemapUrl = sitemapMatch[1].trim()
      }
    }

    // If no sitemap found yet, try the one from robots.txt
    if (!sitemapFound && robotsSitemapUrl) {
      try {
        const sitemapResponse = await fetch(robotsSitemapUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        })
        if (sitemapResponse.ok) {
          sitemapFound = true
          sitemapUrl = robotsSitemapUrl
        } else {
          sitemapError = `Sitemap declared in robots.txt (${robotsSitemapUrl}) but not accessible`
        }
      } catch {
        sitemapError = `Sitemap declared in robots.txt (${robotsSitemapUrl}) but not accessible`
      }
    }

    // If still no sitemap and no robots.txt in context, try fetching robots.txt
    if (!sitemapFound && !context.robotsTxt && !robotsSitemapUrl) {
      try {
        const robotsResponse = await fetch(`${baseUrl}/robots.txt`, {
          signal: AbortSignal.timeout(5000),
        })
        if (robotsResponse.ok) {
          const robotsText = await robotsResponse.text()
          const sitemapMatch = robotsText.match(/^Sitemap:\s*(.+)$/im)
          if (sitemapMatch) {
            robotsSitemapUrl = sitemapMatch[1].trim()
            try {
              const sitemapResponse = await fetch(robotsSitemapUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
              })
              if (sitemapResponse.ok) {
                sitemapFound = true
                sitemapUrl = robotsSitemapUrl
              } else {
                sitemapError = `Sitemap declared in robots.txt (${robotsSitemapUrl}) but not accessible`
              }
            } catch {
              sitemapError = `Sitemap declared in robots.txt (${robotsSitemapUrl}) but not accessible`
            }
          }
        }
      } catch {
        // robots.txt not accessible, continue
      }
    }

    if (sitemapFound) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          sitemapUrl,
        },
      }
    }

    if (sitemapError) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: sitemapError,
        },
      }
    }

    return {
      status: CheckStatus.Failed,
      details: {
        message:
          'No XML sitemap found. Create a sitemap.xml file listing all important pages to help search engines discover your content.',
      },
    }
  },
}
