import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import { pluralize } from '@/lib/utils'
import type {
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  SchemaValidationDetails,
} from '../../types'

interface SchemaSpec {
  required: string[]
  recommended: string[]
}

const SCHEMA_SPECS: Record<string, SchemaSpec> = {
  Article: {
    required: ['headline', 'author', 'datePublished', 'image'],
    recommended: ['dateModified', 'publisher'],
  },
  NewsArticle: {
    required: ['headline', 'author', 'datePublished', 'image'],
    recommended: ['dateModified', 'publisher'],
  },
  BlogPosting: {
    required: ['headline', 'author', 'datePublished', 'image'],
    recommended: ['dateModified', 'publisher'],
  },
  Product: {
    required: ['name', 'image'],
    recommended: ['description', 'offers', 'brand'],
  },
  FAQPage: {
    required: ['mainEntity'],
    recommended: [],
  },
  Organization: {
    required: ['name', 'url'],
    recommended: ['logo', 'description', 'sameAs'],
  },
  Corporation: {
    required: ['name', 'url'],
    recommended: ['logo', 'description', 'sameAs'],
  },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHours'],
  },
}

function getSchemaType(item: Record<string, unknown>): string {
  const type = item['@type']
  if (Array.isArray(type)) return type[0] as string
  return (type as string) || 'Unknown'
}

function validateFAQMainEntity(mainEntity: unknown): string[] {
  const warnings: string[] = []

  if (!Array.isArray(mainEntity)) {
    warnings.push('mainEntity should be an array of Question items')
    return warnings
  }

  if (mainEntity.length === 0) {
    warnings.push('mainEntity array is empty — add Question items')
    return warnings
  }

  for (let i = 0; i < mainEntity.length; i++) {
    const question = mainEntity[i] as Record<string, unknown>
    if (question['@type'] !== 'Question') {
      warnings.push(`mainEntity[${i}] should have @type "Question"`)
    }
    if (!question.name) {
      warnings.push(`mainEntity[${i}] is missing "name" (the question text)`)
    }
    if (!question.acceptedAnswer) {
      warnings.push(`mainEntity[${i}] is missing "acceptedAnswer"`)
    }
  }

  return warnings
}

function validateSchema(item: Record<string, unknown>): {
  type: string
  valid: boolean
  missingRequired: string[]
  missingRecommended: string[]
  warnings: string[]
} {
  const type = getSchemaType(item)

  // Find matching spec — check for exact match first, then Article subtypes
  let spec = SCHEMA_SPECS[type]
  if (!spec) {
    // Check if this is an Article subtype
    const articleSubtypes = ['Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'Report']
    if (Array.isArray(item['@type'])) {
      for (const t of item['@type'] as string[]) {
        if (SCHEMA_SPECS[t]) {
          spec = SCHEMA_SPECS[t]
          break
        }
      }
    }
    if (!spec && articleSubtypes.includes(type)) {
      spec = SCHEMA_SPECS['Article']
    }
  }

  if (!spec) {
    return {
      type,
      valid: true,
      missingRequired: [],
      missingRecommended: [],
      warnings: [`No validation rules defined for schema type "${type}"`],
    }
  }

  const missingRequired = spec.required.filter((field) => !item[field])
  const missingRecommended = spec.recommended.filter((field) => !item[field])
  const warnings: string[] = []

  // Special validation for FAQPage
  if (type === 'FAQPage' && item.mainEntity) {
    warnings.push(...validateFAQMainEntity(item.mainEntity))
  }

  return {
    type,
    valid: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    warnings,
  }
}

export const schemaValidation: AuditCheckDefinition = {
  name: 'schema_validation',
  category: CheckCategory.StructuredData,
  priority: CheckPriority.Recommended,
  description: 'Validates that JSON-LD schemas include required and recommended properties',
  displayName: 'Schema Validation Issues',
  displayNamePassed: 'Schema Validation',
  learnMoreUrl:
    'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  isSiteWide: false,
  fixGuidance:
    'Review your JSON-LD structured data and add any missing required or recommended properties for each schema type.',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const jsonLdScripts = $('script[type="application/ld+json"]')

    if (jsonLdScripts.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          schemas: [],
          totalSchemas: 0,
          validCount: 0,
          invalidCount: 0,
          message: 'No JSON-LD structured data found to validate.',
        } satisfies SchemaValidationDetails & { message: string },
      }
    }

    const allItems: Record<string, unknown>[] = []

    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html()
        if (!content) return

        const data = JSON.parse(content)

        // Handle @graph structure
        const items = data['@graph'] ? data['@graph'] : [data]

        for (const item of items) {
          if (Array.isArray(item)) {
            for (const subItem of item) {
              if (subItem['@type']) {
                allItems.push(subItem as Record<string, unknown>)
              }
            }
          } else if (item['@type']) {
            allItems.push(item as Record<string, unknown>)
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    })

    if (allItems.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          schemas: [],
          totalSchemas: 0,
          validCount: 0,
          invalidCount: 0,
          message: 'JSON-LD found but no valid schemas with @type could be parsed.',
        } satisfies SchemaValidationDetails & { message: string },
      }
    }

    const validationResults = allItems.map(validateSchema)
    const validCount = validationResults.filter((r) => r.valid).length
    const invalidCount = validationResults.filter((r) => !r.valid).length

    const details: SchemaValidationDetails = {
      schemas: validationResults,
      totalSchemas: allItems.length,
      validCount,
      invalidCount,
    }

    if (invalidCount > 0) {
      const invalidSchemas = validationResults
        .filter((r) => !r.valid)
        .map((r) => `${r.type} (missing: ${r.missingRequired.join(', ')})`)

      return {
        status: CheckStatus.Warning,
        details: {
          ...(details as unknown as Record<string, unknown>),
          message: `${invalidCount} of ${pluralize(allItems.length, 'schema')} have missing required properties: ${invalidSchemas.join('; ')}`,
        },
      }
    }

    // All valid — check for recommended fields
    const schemasWithMissingRecommended = validationResults.filter(
      (r) => r.missingRecommended.length > 0
    )

    if (schemasWithMissingRecommended.length > 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          ...(details as unknown as Record<string, unknown>),
          message: undefined,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
    }
  },
}
