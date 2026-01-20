import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingRobotsTxt: AuditCheckDefinition = {
  name: 'missing_robots_txt',
  type: 'seo',
  priority: 'critical',
  description: 'robots.txt helps control how search engines crawl your site',
  displayName: 'Missing robots.txt',
  displayNamePassed: 'robots.txt',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url).origin
    const robotsUrl = `${baseUrl}/robots.txt`

    try {
      const response = await fetch(robotsUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
      })

      if (!response.ok) {
        return {
          status: 'failed',
          details: {
            message: `No robots.txt found (HTTP ${response.status}). Create a robots.txt file to control search engine crawling behavior and point to your sitemap.`,
            statusCode: response.status,
          },
        }
      }

      const content = await response.text()

      // Check if it has meaningful content
      const hasUserAgent = /^User-agent:/im.test(content)
      const hasSitemap = /^Sitemap:/im.test(content)
      const hasDisallow = /^Disallow:/im.test(content)
      const hasAllow = /^Allow:/im.test(content)

      if (!hasUserAgent) {
        return {
          status: 'warning',
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
        status: 'passed',
        details: {
          message: `robots.txt is properly configured${features.length > 0 ? ` with ${features.join(' and ')}` : ''}`,
          url: robotsUrl,
          hasSitemap,
          hasCrawlRules: hasDisallow || hasAllow,
        },
      }
    } catch {
      return {
        status: 'failed',
        details: {
          message:
            'Could not access robots.txt (connection error). Ensure the file exists and is accessible.',
        },
      }
    }
  },
}
