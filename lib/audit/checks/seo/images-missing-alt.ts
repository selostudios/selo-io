import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const imagesMissingAlt: AuditCheckDefinition = {
  name: 'images_missing_alt',
  type: 'seo',
  priority: 'recommended',
  description: 'All images should have alt attributes',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const imagesWithoutAlt = $('img')
      .filter((_, el) => {
        const alt = $(el).attr('alt')
        return alt === undefined
      })
      .length

    if (imagesWithoutAlt > 0) {
      return {
        status: 'failed',
        details: {
          message: `${imagesWithoutAlt} image${imagesWithoutAlt === 1 ? '' : 's'} missing alt text`,
          count: imagesWithoutAlt,
        },
      }
    }

    return { status: 'passed' }
  },
}
