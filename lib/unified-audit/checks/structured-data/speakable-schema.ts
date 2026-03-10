import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type {
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  SpeakableSchemaDetails,
} from '../../types'

function extractSpeakableData(html: string): SpeakableSchemaDetails {
  const $ = cheerio.load(html)
  const jsonLdScripts = $('script[type="application/ld+json"]')

  let hasSpeakable = false
  let schemaType = ''
  const speakableSelectors: string[] = []

  jsonLdScripts.each((_, el) => {
    if (hasSpeakable) return

    try {
      const content = $(el).html()
      if (!content) return

      const json = JSON.parse(content)

      // Handle @graph structure
      const items = json['@graph'] ? json['@graph'] : [json]

      for (const item of items) {
        // Check for SpeakableSpecification as a standalone type
        if (
          item['@type'] === 'SpeakableSpecification' ||
          (Array.isArray(item['@type']) && item['@type'].includes('SpeakableSpecification'))
        ) {
          hasSpeakable = true
          schemaType = 'SpeakableSpecification'

          if (Array.isArray(item.cssSelector)) {
            speakableSelectors.push(...item.cssSelector)
          } else if (typeof item.cssSelector === 'string') {
            speakableSelectors.push(item.cssSelector)
          }
          if (Array.isArray(item.xpath)) {
            speakableSelectors.push(...item.xpath)
          } else if (typeof item.xpath === 'string') {
            speakableSelectors.push(item.xpath)
          }
          break
        }

        // Check for speakable property on other schema types
        if (item.speakable) {
          hasSpeakable = true
          schemaType = Array.isArray(item['@type'])
            ? item['@type'].join(', ')
            : item['@type'] || 'Unknown'

          const speakable = item.speakable

          // speakable can be a SpeakableSpecification object or array of them
          const speakableItems = Array.isArray(speakable) ? speakable : [speakable]

          for (const spec of speakableItems) {
            if (Array.isArray(spec.cssSelector)) {
              speakableSelectors.push(...spec.cssSelector)
            } else if (typeof spec.cssSelector === 'string') {
              speakableSelectors.push(spec.cssSelector)
            }
            if (Array.isArray(spec.xpath)) {
              speakableSelectors.push(...spec.xpath)
            } else if (typeof spec.xpath === 'string') {
              speakableSelectors.push(spec.xpath)
            }
          }
          break
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  })

  return {
    hasSpeakable,
    schemaType,
    speakableSelectors,
    speakableCount: speakableSelectors.length,
  }
}

export const speakableSchema: AuditCheckDefinition = {
  name: 'speakable_schema',
  category: CheckCategory.StructuredData,
  priority: CheckPriority.Optional,
  description:
    'Speakable schema markup identifies content sections suitable for text-to-speech and voice assistants',
  displayName: 'Missing Speakable Schema',
  displayNamePassed: 'Speakable Schema',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/speakable',
  isSiteWide: false,
  fixGuidance:
    'Add speakable property to your Article or WebPage schema to identify content sections best suited for audio playback by voice assistants.',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const speakableData = extractSpeakableData(context.html)

    if (!speakableData.hasSpeakable) {
      return {
        status: CheckStatus.Failed,
        details: {
          ...(speakableData as unknown as Record<string, unknown>),
          message:
            'No speakable schema found. Adding speakable markup helps voice assistants and AI identify the most important content to read aloud.',
        },
      }
    }

    if (speakableData.speakableCount === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          ...(speakableData as unknown as Record<string, unknown>),
          message: `Speakable schema found on ${speakableData.schemaType} but no CSS selectors or XPath expressions specified.`,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        ...(speakableData as unknown as Record<string, unknown>),
        message: `Speakable schema found on ${speakableData.schemaType} with ${speakableData.speakableCount} selector(s).`,
      },
    }
  },
}
