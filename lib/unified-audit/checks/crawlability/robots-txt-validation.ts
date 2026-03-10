import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const robotsTxtValidation: AuditCheckDefinition = {
  name: 'robots_txt_validation',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Critical,
  description: 'robots.txt helps control how search engines crawl your site',
  displayName: 'Missing robots.txt',
  displayNamePassed: 'robots.txt',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
  isSiteWide: true,
  fixGuidance:
    'Create a robots.txt file at the root of your domain with User-agent directives, crawl rules, and a Sitemap reference.',
  feedsScores: [ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url).origin
    const robotsUrl = `${baseUrl}/robots.txt`

    // If robotsTxt was already fetched and provided in context, use it
    if (context.robotsTxt !== undefined) {
      return analyzeRobotsTxt(context.robotsTxt, robotsUrl)
    }

    try {
      const response = await fetch(robotsUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
      })

      if (!response.ok) {
        return {
          status: CheckStatus.Failed,
          details: {
            message: `No robots.txt found (HTTP ${response.status}). Create a robots.txt file to control search engine crawling behavior and point to your sitemap.`,
            statusCode: response.status,
          },
        }
      }

      const content = await response.text()
      return analyzeRobotsTxt(content, robotsUrl)
    } catch {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Could not access robots.txt (connection error). Ensure the file exists and is accessible.',
        },
      }
    }
  },
}

function analyzeRobotsTxt(content: string, robotsUrl: string): CheckResult {
  const hasUserAgent = /^User-agent:/im.test(content)
  const hasSitemap = /^Sitemap:/im.test(content)
  const hasDisallow = /^Disallow:/im.test(content)
  const hasAllow = /^Allow:/im.test(content)

  if (!hasUserAgent) {
    return {
      status: CheckStatus.Warning,
      details: {
        message:
          'robots.txt exists but appears to be empty or malformed. Add User-agent directives to properly configure crawler behavior.',
        url: robotsUrl,
      },
    }
  }

  const features = []
  if (hasDisallow || hasAllow) features.push('crawl rules')
  if (hasSitemap) features.push('sitemap reference')

  return {
    status: CheckStatus.Passed,
    details: {
      message: `robots.txt is properly configured${features.length > 0 ? ` with ${features.join(' and ')}` : ''}`,
      url: robotsUrl,
      hasSitemap,
      hasCrawlRules: hasDisallow || hasAllow,
    },
  }
}
