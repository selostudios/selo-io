import * as cheerio from 'cheerio'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import { pluralize } from '@/lib/utils'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/unified-audit/types'
import { CheckCategory, ScoreDimension } from '@/lib/enums'

export const definitionBoxes: AuditCheckDefinition = {
  name: 'definition_boxes',
  category: CheckCategory.ContentStructure,
  priority: CheckPriority.Recommended,
  description: '"What is X" sections help AI engines provide quick definitions',
  displayName: 'No Definition Sections',
  displayNamePassed: 'Definition Sections Present',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/featured-snippets',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for "What is" headings
    const definitionHeadings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /^what is|^what are|^definition|^meaning of/.test(text.trim())
    })

    // Check for definition lists
    const definitionLists = $('dl').length

    // Check for content with definition patterns
    const paragraphs = $('p')
    const definitionParagraphs = paragraphs.filter((_, el) => {
      const text = $(el).text()
      // Look for paragraphs that start with "X is a/an" or "X refers to"
      return /^[A-Z][a-z\s]+ (is (a|an)|refers to|means|defined as)/i.test(text.trim())
    })

    const foundDefinitions = []
    if (definitionHeadings.length > 0) {
      foundDefinitions.push(`${pluralize(definitionHeadings.length, '"What is" heading')}`)
    }
    if (definitionLists > 0) {
      foundDefinitions.push(`${pluralize(definitionLists, 'definition list')}`)
    }
    if (definitionParagraphs.length > 0) {
      foundDefinitions.push(`${pluralize(definitionParagraphs.length, 'definition paragraph')}`)
    }

    if (foundDefinitions.length === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message:
            'No clear definition sections found. AI engines prefer explicit "What is X" content for featured snippets.',
          fixGuidance:
            'Add a "What is [topic]?" section near the top with a concise 2-3 sentence definition.',
        },
      }
    } else {
      return {
        status: CheckStatus.Passed,
      }
    }
  },
}
