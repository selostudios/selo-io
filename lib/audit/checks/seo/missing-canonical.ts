import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const missingCanonical: AuditCheckDefinition = {
  name: 'missing_canonical',
  type: CheckType.SEO,
  priority: CheckPriority.Recommended,
  description: 'Pages should have a canonical URL tag',
  displayName: 'Missing Canonical URL',
  displayNamePassed: 'Canonical URL',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const canonical = $('link[rel="canonical"]').attr('href')

    if (!canonical || canonical.trim() === '') {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Add <link rel="canonical" href="${context.url}"> to the <head>. This tells search engines which URL is the "official" version when duplicate content exists.`,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: canonical,
      },
    }
  },
}
