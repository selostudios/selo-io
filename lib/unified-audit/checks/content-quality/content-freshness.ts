import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

const PASS_THRESHOLD_DAYS = 90
const WARNING_THRESHOLD_DAYS = 365

export const contentFreshness: AuditCheckDefinition = {
  name: 'content_freshness',
  category: CheckCategory.ContentQuality,
  priority: CheckPriority.Recommended,
  description: 'Fresh content signals relevance to search engines and AI systems',
  displayName: 'Stale Content',
  displayNamePassed: 'Content Freshness',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  isSiteWide: false,
  fixGuidance:
    'Update content regularly with new information, examples, and dates. Add a visible last-updated timestamp.',
  feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const now = new Date()

    // Check for last-modified date from crawled page data
    // The allPages array contains last_modified info from HTTP headers
    let lastModifiedDate: Date | null = null

    if (context.allPages) {
      for (const page of context.allPages) {
        if (page.url === context.url) {
          const pageWithMeta = page as {
            url: string
            title: string | null
            statusCode: number | null
            last_modified?: string | null
          }
          if (pageWithMeta.last_modified) {
            const date = new Date(pageWithMeta.last_modified)
            if (!isNaN(date.getTime())) {
              lastModifiedDate = date
            }
          }
          break
        }
      }
    }

    // Also check HTML meta tags for date indicators
    if (!lastModifiedDate) {
      const datePatterns = [
        /<meta[^>]*name=["'](?:article:modified_time|last-modified|dcterms\.modified)["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["'](?:article:modified_time|last-modified|dcterms\.modified)["']/i,
        /<meta[^>]*property=["'](?:article:modified_time|og:updated_time)["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:article:modified_time|og:updated_time)["']/i,
        /<time[^>]*datetime=["']([^"']+)["'][^>]*(?:class|itemprop)=["'][^"']*(?:modified|updated)[^"']*["']/i,
      ]

      for (const pattern of datePatterns) {
        const match = context.html.match(pattern)
        if (match) {
          const date = new Date(match[1])
          if (!isNaN(date.getTime())) {
            lastModifiedDate = date
            break
          }
        }
      }
    }

    // Check for published date as fallback
    if (!lastModifiedDate) {
      const publishedPatterns = [
        /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
        /<time[^>]*datetime=["']([^"']+)["'][^>]*(?:class|itemprop)=["'][^"']*(?:publish|date)[^"']*["']/i,
      ]

      for (const pattern of publishedPatterns) {
        const match = context.html.match(pattern)
        if (match) {
          const date = new Date(match[1])
          if (!isNaN(date.getTime())) {
            lastModifiedDate = date
            break
          }
        }
      }
    }

    if (!lastModifiedDate) {
      return {
        status: CheckStatus.Warning,
        details: {
          message:
            'Unable to determine content freshness. No Last-Modified headers or date meta tags found. Consider adding timestamps to help search engines assess content relevance.',
        },
      }
    }

    const daysSinceUpdate = Math.floor(
      (now.getTime() - lastModifiedDate.getTime()) / (24 * 60 * 60 * 1000)
    )

    // Thresholds: <90 days pass, 90-365 days warning, >365 days fail
    if (daysSinceUpdate <= PASS_THRESHOLD_DAYS) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          daysSinceUpdate,
          lastUpdate: lastModifiedDate.toISOString(),
        },
      }
    } else if (daysSinceUpdate <= WARNING_THRESHOLD_DAYS) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Content last updated ${daysSinceUpdate} days ago. Consider refreshing to maintain relevance.`,
          daysSinceUpdate,
          lastUpdate: lastModifiedDate.toISOString(),
          fixGuidance:
            'Review and update content with current information. Add a visible last-updated date.',
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Content is ${daysSinceUpdate} days old (over 1 year). Stale content may be deprioritized by search engines and AI systems.`,
          daysSinceUpdate,
          lastUpdate: lastModifiedDate.toISOString(),
          fixGuidance:
            'Significantly update or rewrite content with current information, examples, and data.',
        },
      }
    }
  },
}
