import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const titleLength: AuditCheckDefinition = {
  name: 'title_length',
  type: 'seo',
  priority: 'recommended',
  description: 'Title should be 60 characters or less',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const title = $('title').text().trim()

    if (!title) {
      return { status: 'passed' } // Missing title is handled by missing_title check
    }

    if (title.length > 60) {
      return {
        status: 'warning',
        details: {
          message: `Title is ${title.length} characters (recommended: 60 max)`,
          length: title.length,
        },
      }
    }

    return { status: 'passed' }
  },
}
