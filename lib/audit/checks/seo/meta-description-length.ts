import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const metaDescriptionLength: AuditCheckDefinition = {
  name: 'meta_description_length',
  type: CheckType.SEO,
  priority: CheckPriority.Recommended,
  description: 'Meta description should be between 150-160 characters',
  displayName: 'Meta Description Length',
  displayNamePassed: 'Meta Description Length',
  learnMoreUrl:
    'https://developers.google.com/search/docs/fundamentals/seo-starter-guide#use-the-description-meta-tag',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const metaDescription = $('meta[name="description"]').attr('content')

    if (!metaDescription || metaDescription.trim() === '') {
      return { status: CheckStatus.Passed } // Missing meta description is handled by missing_meta_description check
    }

    const length = metaDescription.trim().length

    if (length < 120) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Meta description is only ${length} characters. Aim for 150-160 characters to maximize space in search results without truncation.`,
          length,
        },
      }
    }

    if (length > 160) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Meta description is ${length} characters and may be truncated. Aim for 150-160 characters for optimal display in search results.`,
          length,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: `${length} characters (optimal)`,
      },
    }
  },
}
