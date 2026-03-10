import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const noindexDetection: AuditCheckDefinition = {
  name: 'noindex_detection',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Critical,
  description:
    'Noindex meta tags prevent search engines from indexing pages. Critical pages should not have noindex.',
  displayName: 'Noindex Tag on Important Pages',
  displayNamePassed: 'No Noindex Issues',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/block-indexing',
  isSiteWide: false,
  fixGuidance:
    'Remove the noindex meta tag from important pages that should appear in search results. Keep noindex only on pages like admin panels, thank-you pages, or duplicate content.',
  feedsScores: [ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for noindex in meta robots
    const metaRobots = $('meta[name="robots"]').attr('content')?.toLowerCase()
    const metaGooglebot = $('meta[name="googlebot"]').attr('content')?.toLowerCase()

    const hasNoindex =
      metaRobots?.includes('noindex') || metaGooglebot?.includes('noindex') || false

    if (hasNoindex) {
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
