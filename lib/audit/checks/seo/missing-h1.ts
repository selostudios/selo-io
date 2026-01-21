import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingH1: AuditCheckDefinition = {
  name: 'missing_h1',
  type: 'seo',
  priority: 'critical',
  description: 'Pages must have an H1 tag',
  displayName: 'Missing H1 Heading',
  displayNamePassed: 'H1 Heading',
  learnMoreUrl:
    'https://developers.google.com/search/docs/fundamentals/seo-starter-guide#use-heading-tags',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const h1 = $('h1').first()

    if (h1.length === 0) {
      return {
        status: 'failed',
        details: {
          message:
            'Add an <h1> tag with your main page headline. Every page should have exactly one H1 that describes the page content.',
        },
      }
    }

    const h1Text = h1.text().trim()
    return {
      status: 'passed',
      details: {
        message: `"${h1Text.slice(0, 50)}${h1Text.length > 50 ? '...' : ''}"`,
      },
    }
  },
}
