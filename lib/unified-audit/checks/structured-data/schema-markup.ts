import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const schemaMarkup: AuditCheckDefinition = {
  name: 'schema_markup',
  category: CheckCategory.StructuredData,
  priority: CheckPriority.Critical,
  description: 'Check for JSON-LD structured data to help search engines and AI understand content',
  displayName: 'Missing Structured Data',
  displayNamePassed: 'Structured Data (JSON-LD)',
  learnMoreUrl:
    'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  isSiteWide: false,
  fixGuidance:
    'Add JSON-LD structured data to help search engines and AI understand your content. Common types include Organization, Article, Product, and FAQ.',
  feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const jsonLdScripts = $('script[type="application/ld+json"]')

    if (jsonLdScripts.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'No JSON-LD structured data found. Add structured data to help search engines and AI understand your content.',
          schemas: [],
          totalSchemas: 0,
        },
      }
    }

    // Parse all JSON-LD schemas and extract types
    const schemas: string[] = []
    let validCount = 0

    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html()
        if (!content) return

        const data = JSON.parse(content)

        // Handle @graph structure
        const items = data['@graph'] ? data['@graph'] : [data]

        for (const item of items) {
          if (Array.isArray(item)) {
            // Handle array of schemas
            for (const subItem of item) {
              if (subItem['@type']) {
                schemas.push(
                  Array.isArray(subItem['@type'])
                    ? subItem['@type'].join(', ')
                    : subItem['@type']
                )
                validCount++
              }
            }
          } else if (item['@type']) {
            schemas.push(
              Array.isArray(item['@type']) ? item['@type'].join(', ') : item['@type']
            )
            validCount++
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    })

    // Check for AIO-relevant schema types
    const aioRelevantTypes = [
      'Article',
      'FAQPage',
      'HowTo',
      'Organization',
      'Person',
      'Product',
      'Review',
      'LocalBusiness',
      'Corporation',
    ]
    const foundRelevant = schemas.filter((schema) =>
      aioRelevantTypes.some((relevant) => schema.includes(relevant))
    )

    if (validCount === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'JSON-LD script tags found but could not parse any valid schemas. Check for malformed JSON.',
          schemas: [],
          totalSchemas: 0,
        },
      }
    }

    if (foundRelevant.length === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Found structured data (${schemas.join(', ')}) but none are highly relevant for AI. Consider adding Article, FAQPage, or Organization schemas.`,
          schemas,
          totalSchemas: validCount,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message:
          schemas.length > 0
            ? `Found ${validCount} schema(s): ${schemas.join(', ')}`
            : 'JSON-LD structured data found',
        schemas,
        totalSchemas: validCount,
      },
    }
  },
}
