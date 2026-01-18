import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingTitle: AuditCheckDefinition = {
  name: 'missing_title',
  type: 'seo',
  priority: 'critical',
  description: 'Pages must have a title tag',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const title = $('title').text().trim()

    if (!title) {
      return {
        status: 'failed',
        details: {
          message: 'No title tag found',
        },
      }
    }

    return { status: 'passed' }
  },
}
