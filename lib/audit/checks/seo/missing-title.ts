import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingTitle: AuditCheckDefinition = {
  name: 'missing_title',
  type: 'seo',
  priority: 'critical',
  description: 'Pages must have a title tag',
  displayName: 'Missing Page Title',
  displayNamePassed: 'Page Title',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/title-link',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const title = $('title').text().trim()

    if (!title) {
      return {
        status: 'failed',
        details: {
          message:
            'Add a <title> tag to the <head> section. This appears as the clickable headline in search results.',
        },
      }
    }

    return {
      status: 'passed',
      details: {
        message: `"${title.slice(0, 50)}${title.length > 50 ? '...' : ''}"`,
      },
    }
  },
}
