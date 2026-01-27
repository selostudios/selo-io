import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const noindexOnImportantPages: AuditCheckDefinition = {
  name: 'noindex_on_important_pages',
  type: CheckType.SEO,
  priority: CheckPriority.Critical,
  description:
    'Noindex meta tags prevent search engines from indexing pages. Critical pages should not have noindex.',
  displayName: 'Noindex Tag on Important Pages',
  displayNamePassed: 'No Noindex Issues',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/block-indexing',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for noindex in meta robots
    const metaRobots = $('meta[name="robots"]').attr('content')?.toLowerCase()
    const metaGooglebot = $('meta[name="googlebot"]').attr('content')?.toLowerCase()

    // Check for noindex in X-Robots-Tag header (would need to be passed in context)
    // For now, we'll just check meta tags

    const hasNoindex =
      metaRobots?.includes('noindex') || metaGooglebot?.includes('noindex') || false

    if (hasNoindex) {
      // Determine if this is an important page (homepage, main sections)
      const url = new URL(context.url)
      const path = url.pathname

      // Consider homepage and top-level paths as important
      const isImportant = path === '/' || path === '' || path.split('/').filter(Boolean).length <= 1

      if (isImportant) {
        return {
          status: CheckStatus.Failed,
          details: {
            message: `This important page has a noindex directive (${metaRobots || metaGooglebot}), preventing search engines from indexing it. Remove the noindex tag unless this is intentional.`,
            metaContent: metaRobots || metaGooglebot,
            path,
          },
        }
      }

      // Not an important page, but still worth noting
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Page has noindex directive (${metaRobots || metaGooglebot}). Verify this is intentional.`,
          metaContent: metaRobots || metaGooglebot,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: 'No noindex directives found on this page',
      },
    }
  },
}
