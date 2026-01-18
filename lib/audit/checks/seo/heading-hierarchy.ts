import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const headingHierarchy: AuditCheckDefinition = {
  name: 'heading_hierarchy',
  type: 'seo',
  priority: 'recommended',
  description: 'Heading levels should not be skipped',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const headings = $('h1, h2, h3, h4, h5, h6')
      .map((_, el) => parseInt(el.tagName.charAt(1), 10))
      .get()

    if (headings.length === 0) {
      return { status: 'passed' }
    }

    const skippedLevels: string[] = []
    let previousLevel = 0

    for (const level of headings) {
      if (previousLevel > 0 && level > previousLevel + 1) {
        skippedLevels.push(`H${previousLevel} to H${level}`)
      }
      previousLevel = level
    }

    if (skippedLevels.length > 0) {
      return {
        status: 'warning',
        details: {
          message: `Heading levels skipped: ${skippedLevels.join(', ')}`,
          skippedLevels,
        },
      }
    }

    return { status: 'passed' }
  },
}
