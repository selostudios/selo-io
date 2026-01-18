import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingH1: AuditCheckDefinition = {
  name: 'missing_h1',
  type: 'seo',
  priority: 'critical',
  description: 'Pages must have an H1 tag',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const h1Count = $('h1').length

    if (h1Count === 0) {
      return {
        status: 'failed',
        details: {
          message: 'No H1 tag found',
        },
      }
    }

    return { status: 'passed' }
  },
}
