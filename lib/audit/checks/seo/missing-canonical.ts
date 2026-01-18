import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingCanonical: AuditCheckDefinition = {
  name: 'missing_canonical',
  type: 'seo',
  priority: 'recommended',
  description: 'Pages should have a canonical URL tag',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const canonical = $('link[rel="canonical"]').attr('href')

    if (!canonical || canonical.trim() === '') {
      return {
        status: 'warning',
        details: {
          message: 'No canonical URL tag found',
        },
      }
    }

    return { status: 'passed' }
  },
}
