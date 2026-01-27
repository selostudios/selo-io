import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const missingMetaDescription: AuditCheckDefinition = {
  name: 'missing_meta_description',
  type: CheckType.SEO,
  priority: CheckPriority.Critical,
  description: 'Pages without meta description tags',
  displayName: 'Missing Meta Description',
  displayNamePassed: 'Meta Description',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/snippet#meta-descriptions',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const metaDescription = $('meta[name="description"]').attr('content')

    if (!metaDescription || metaDescription.trim() === '') {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Add a <meta name="description" content="..."> tag to the <head> section. This 150-160 character summary appears in search results.',
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: `Found: "${metaDescription.slice(0, 60)}${metaDescription.length > 60 ? '...' : ''}"`,
      },
    }
  },
}
