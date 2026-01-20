import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const multipleH1: AuditCheckDefinition = {
  name: 'multiple_h1',
  type: 'seo',
  priority: 'recommended',
  description: 'Pages should have only one H1 tag',
  displayName: 'Multiple H1 Headings',
  displayNamePassed: 'Single H1 Heading',
  learnMoreUrl:
    'https://developers.google.com/search/docs/fundamentals/seo-starter-guide#use-heading-tags',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const h1Elements = $('h1')
    const h1Count = h1Elements.length

    if (h1Count > 1) {
      const h1Texts = h1Elements
        .map((_, el) => $(el).text().trim().slice(0, 30))
        .get()
        .join('", "')

      return {
        status: 'warning',
        details: {
          message: `Found ${h1Count} H1 tags: "${h1Texts}". Use only one H1 per page for the main heading. Use H2-H6 for subheadings.`,
          count: h1Count,
        },
      }
    }

    return { status: 'passed' }
  },
}
