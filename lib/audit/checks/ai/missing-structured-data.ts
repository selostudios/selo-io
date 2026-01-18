import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingStructuredData: AuditCheckDefinition = {
  name: 'missing_structured_data',
  type: 'ai_readiness',
  priority: 'critical',
  description: 'Check for JSON-LD structured data',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const jsonLd = $('script[type="application/ld+json"]')

    if (jsonLd.length === 0) {
      return {
        status: 'failed',
        details: { message: 'No JSON-LD structured data found' },
      }
    }

    return { status: 'passed' }
  },
}
