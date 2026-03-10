import * as cheerio from 'cheerio'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/unified-audit/types'
import { CheckCategory, ScoreDimension } from '@/lib/enums'

export const headingHierarchy: AuditCheckDefinition = {
  name: 'heading_hierarchy',
  category: CheckCategory.ContentStructure,
  priority: CheckPriority.Recommended,
  description: 'Heading levels should not be skipped',
  displayName: 'Skipped Heading Levels',
  displayNamePassed: 'Heading Hierarchy',
  learnMoreUrl:
    'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements#usage_notes',
  feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const headings = $('h1, h2, h3, h4, h5, h6')
      .map((_, el) => parseInt(el.tagName.charAt(1), 10))
      .get()

    if (headings.length === 0) {
      return { status: CheckStatus.Passed }
    }

    const skippedLevels: string[] = []
    let previousLevel = 0

    for (const level of headings) {
      if (previousLevel > 0 && level > previousLevel + 1) {
        skippedLevels.push(`H${previousLevel} \u2192 H${level}`)
      }
      previousLevel = level
    }

    if (skippedLevels.length > 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Headings should follow a logical order (H1 \u2192 H2 \u2192 H3). Skipped: ${skippedLevels.join(', ')}. This helps screen readers and search engines understand content structure.`,
          skippedLevels,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: 'Headings follow correct hierarchy',
      },
    }
  },
}
