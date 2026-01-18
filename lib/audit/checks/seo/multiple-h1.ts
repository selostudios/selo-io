import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const multipleH1: AuditCheckDefinition = {
  name: 'multiple_h1',
  type: 'seo',
  priority: 'recommended',
  description: 'Pages should have only one H1 tag',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const h1Count = $('h1').length

    if (h1Count > 1) {
      return {
        status: 'warning',
        details: {
          message: `Found ${h1Count} H1 tags (recommended: 1)`,
          count: h1Count,
        },
      }
    }

    return { status: 'passed' }
  },
}
