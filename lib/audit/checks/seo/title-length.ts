import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const titleLength: AuditCheckDefinition = {
  name: 'title_length',
  type: CheckType.SEO,
  priority: CheckPriority.Recommended,
  description: 'Title should be 60 characters or less',
  displayName: 'Title Too Long',
  displayNamePassed: 'Title Length',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/title-link#page-titles',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const title = $('title').text().trim()

    if (!title) {
      return { status: CheckStatus.Passed } // Missing title is handled by missing_title check
    }

    if (title.length > 60) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Title is ${title.length} characters. Google typically displays 50-60 characters. Consider shortening to prevent truncation in search results.`,
          length: title.length,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: `${title.length} characters (good)`,
      },
    }
  },
}
