import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const schemaMarkup: AIOCheckDefinition = {
  name: 'schema_markup',
  category: AIOCheckCategory.TechnicalFoundation,
  priority: CheckPriority.Critical,
  description: 'Structured data helps AI engines understand and extract your content',
  displayName: 'Missing Structured Data',
  displayNamePassed: 'Structured Data Present',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Find all JSON-LD scripts
    const jsonLdScripts = $('script[type="application/ld+json"]')
    const schemas: string[] = []

    jsonLdScripts.each((_, element) => {
      try {
        const content = $(element).html()
        if (content) {
          const data = JSON.parse(content)
          const type = data['@type'] || (Array.isArray(data) ? data.map((d: { '@type': string }) => d['@type']).join(', ') : 'Unknown')
          schemas.push(type)
        }
      } catch {
        // Invalid JSON, skip
      }
    })

    // Prioritize schema types most valuable for AIO
    const aioRelevantSchemas = ['Article', 'FAQPage', 'HowTo', 'Organization', 'Person', 'Product', 'Review']
    const foundRelevant = schemas.filter(schema =>
      aioRelevantSchemas.some(relevant => schema.includes(relevant))
    )

    if (schemas.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: 'No structured data found. AI engines rely on Schema.org markup to understand content type and extract key information.',
          fixGuidance: 'Add JSON-LD structured data for Article, FAQPage, or HowTo depending on your content type.',
        },
      }
    }

    if (foundRelevant.length === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Found structured data (${schemas.join(', ')}) but none are highly relevant for AIO. Consider adding Article, FAQPage, or HowTo schemas.`,
          foundSchemas: schemas,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: `Found ${foundRelevant.length} AIO-relevant schema(s): ${foundRelevant.join(', ')}`,
        foundSchemas: schemas,
      },
    }
  },
}
