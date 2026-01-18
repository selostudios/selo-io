import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingViewport: AuditCheckDefinition = {
  name: 'missing_viewport',
  type: 'technical',
  priority: 'recommended',
  description: 'Pages without viewport meta tag for mobile-friendliness',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const viewport = $('meta[name="viewport"]').attr('content')

    if (!viewport) {
      return {
        status: 'warning',
        details: {
          message: 'No viewport meta tag found (may not be mobile-friendly)',
        },
      }
    }

    return { status: 'passed' }
  },
}
