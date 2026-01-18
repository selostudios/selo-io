import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingFavicon: AuditCheckDefinition = {
  name: 'missing_favicon',
  type: 'technical',
  priority: 'optional',
  description: 'Pages without a favicon link',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href')

    if (!favicon) {
      return {
        status: 'warning',
        details: {
          message: 'No favicon link found',
        },
      }
    }

    return { status: 'passed' }
  },
}
