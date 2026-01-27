import * as cheerio from 'cheerio'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingStructuredData: AuditCheckDefinition = {
  name: 'missing_structured_data',
  type: CheckType.AIReadiness,
  priority: CheckPriority.Critical,
  description: 'Check for JSON-LD structured data',
  displayName: 'Missing Structured Data',
  displayNamePassed: 'Structured Data (JSON-LD)',
  learnMoreUrl:
    'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const jsonLdScripts = $('script[type="application/ld+json"]')

    if (jsonLdScripts.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Add JSON-LD structured data to help search engines and AI understand your content. Common types include Organization, Article, Product, and FAQ.',
        },
      }
    }

    // Try to extract schema types
    const types: string[] = []
    jsonLdScripts.each((_, el) => {
      try {
        const json = JSON.parse($(el).text())
        if (json['@type']) {
          types.push(json['@type'])
        }
      } catch {
        // Invalid JSON
      }
    })

    return {
      status: CheckStatus.Passed,
      details: {
        message: types.length > 0 ? `Found: ${types.join(', ')}` : 'JSON-LD structured data found',
      },
    }
  },
}
