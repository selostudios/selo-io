import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const metaDescriptionLength: AuditCheckDefinition = {
  name: 'meta_description_length',
  type: 'seo',
  priority: 'recommended',
  description: 'Meta description should be between 150-160 characters',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const metaDescription = $('meta[name="description"]').attr('content')

    if (!metaDescription || metaDescription.trim() === '') {
      return { status: 'passed' } // Missing meta description is handled by missing_meta_description check
    }

    const length = metaDescription.trim().length

    if (length < 150) {
      return {
        status: 'warning',
        details: {
          message: `Meta description is ${length} characters (recommended: 150-160)`,
          length,
        },
      }
    }

    if (length > 160) {
      return {
        status: 'warning',
        details: {
          message: `Meta description is ${length} characters (recommended: 150-160)`,
          length,
        },
      }
    }

    return { status: 'passed' }
  },
}
