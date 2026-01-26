import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const httpToHttpsRedirect: AuditCheckDefinition = {
  name: 'http_to_https_redirect',
  type: 'seo',
  priority: 'critical',
  description: 'HTTP version should redirect to HTTPS to consolidate SEO signals and ensure security',
  displayName: 'Missing HTTP to HTTPS Redirect',
  displayNamePassed: 'HTTP to HTTPS Redirect',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const url = new URL(context.url)

    // Skip if already HTTP (missing SSL - handled by other check)
    if (url.protocol === 'http:') {
      return {
        status: 'passed',
        details: {
          message: 'Site uses HTTP (SSL check handles this separately)',
        },
      }
    }

    // Construct HTTP version of the URL
    const httpUrl = context.url.replace('https://', 'http://')

    try {
      const response = await fetch(httpUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        redirect: 'manual', // Don't follow redirects automatically
      })

      const status = response.status

      // Check if it redirects to HTTPS
      if (status >= 300 && status < 400) {
        const location = response.headers.get('location')

        if (location) {
          const redirectUrl = new URL(location, httpUrl)

          if (redirectUrl.protocol === 'https:') {
            return {
              status: 'passed',
              details: {
                message: `HTTP correctly redirects to HTTPS (${status} redirect)`,
                redirectStatus: status,
                redirectLocation: location,
              },
            }
          } else {
            return {
              status: 'warning',
              details: {
                message: `HTTP redirects but not to HTTPS. Location: ${location}`,
                redirectStatus: status,
                redirectLocation: location,
              },
            }
          }
        }
      }

      // No redirect - both HTTP and HTTPS versions accessible
      return {
        status: 'failed',
        details: {
          message: `HTTP version is accessible without redirecting to HTTPS (returned ${status}). Configure a 301 redirect from HTTP to HTTPS to consolidate SEO signals and ensure security.`,
          httpStatus: status,
        },
      }
    } catch {
      // HTTP version not accessible - this is actually good
      return {
        status: 'passed',
        details: {
          message: 'HTTP version is not accessible (likely server-level block)',
          note: 'This is fine as long as all links use HTTPS',
        },
      }
    }
  },
}
