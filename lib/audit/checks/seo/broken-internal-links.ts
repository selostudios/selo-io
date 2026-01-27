import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const brokenInternalLinks: AuditCheckDefinition = {
  name: 'broken_internal_links',
  type: CheckType.SEO,
  priority: CheckPriority.Critical,
  description: 'Internal links returning 4xx/5xx errors hurt SEO and user experience',
  displayName: 'Broken Internal Links',
  displayNamePassed: 'Internal Links',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/http-network-errors',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const brokenPages = context.allPages.filter((page) => {
      const status = page.status_code ?? 200
      return status >= 400
    })

    if (brokenPages.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `All ${context.allPages.length} internal pages returned successful status codes`,
          totalPages: context.allPages.length,
        },
      }
    }

    // Group by status code for better reporting
    const byStatus: Record<number, string[]> = {}
    for (const page of brokenPages) {
      const status = page.status_code ?? 0
      if (!byStatus[status]) {
        byStatus[status] = []
      }
      byStatus[status].push(page.url)
    }

    const statusSummary = Object.entries(byStatus)
      .map(([status, urls]) => `${status}: ${urls.length} page${urls.length > 1 ? 's' : ''}`)
      .join(', ')

    return {
      status: CheckStatus.Failed,
      details: {
        message: `Found ${brokenPages.length} broken internal link${brokenPages.length > 1 ? 's' : ''} (${statusSummary}). Fix or remove these links to improve SEO and user experience.`,
        brokenCount: brokenPages.length,
        brokenUrls: brokenPages.slice(0, 10).map((p) => ({
          url: p.url,
          status: p.status_code,
        })),
        byStatus,
      },
    }
  },
}
