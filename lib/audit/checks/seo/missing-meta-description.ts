import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingMetaDescription: AuditCheckDefinition = {
  name: 'missing_meta_description',
  type: 'seo',
  priority: 'critical',
  description: 'Pages without meta description tags',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const metaDescription = $('meta[name="description"]').attr('content')

    if (!metaDescription || metaDescription.trim() === '') {
      return {
        status: 'failed',
        details: {
          message: 'No meta description found',
        },
      }
    }

    return { status: 'passed' }
  },
}
