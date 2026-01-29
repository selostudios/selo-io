import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const stepByStepGuides: AIOCheckDefinition = {
  name: 'step_by_step_guides',
  category: AIOCheckCategory.ContentStructure,
  priority: CheckPriority.Recommended,
  description: 'How-to content with clear steps is highly citable by AI engines',
  displayName: 'No Step-by-Step Content',
  displayNamePassed: 'Step-by-Step Content Present',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/how-to',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for HowTo schema
    const hasHowToSchema =
      $('script[type="application/ld+json"]').filter((_, el) => {
        const content = $(el).html()
        return !!(content?.includes('"@type":"HowTo"') || content?.includes('"@type": "HowTo"'))
      }).length > 0

    // Check for how-to headings
    const howToHeadings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /^how to|^step[s]? to|^guide to|steps:|tutorial/i.test(text.trim())
    }).length

    // Check for ordered lists (common for step-by-step)
    const orderedLists = $('ol').length
    const orderedListItems = $('ol li').length

    // Check for step numbering patterns in headings
    const stepHeadings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text()
      return /^(step\s+)?\d+[\.\):\s]/i.test(text.trim())
    }).length

    const indicators = []
    if (hasHowToSchema) indicators.push('HowTo schema')
    if (howToHeadings > 0) indicators.push('how-to heading')
    if (orderedLists > 0) indicators.push(`${orderedLists} ordered list(s)`)
    if (stepHeadings > 0) indicators.push(`${stepHeadings} numbered step heading(s)`)

    if (indicators.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: 'No procedural content detected (not applicable for this page type)',
        },
      }
    } else if (hasHowToSchema) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `How-to content with structured data: ${indicators.join(', ')}`,
          indicators,
          orderedListItems,
        },
      }
    } else if (orderedListItems >= 3 || stepHeadings >= 3) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Step-by-step content detected (${indicators.join(', ')}) but missing HowTo schema markup`,
          indicators,
          fixGuidance:
            'Add HowTo structured data to help AI engines extract step-by-step instructions.',
        },
      }
    } else {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `Some procedural content: ${indicators.join(', ')}`,
          indicators,
        },
      }
    }
  },
}
