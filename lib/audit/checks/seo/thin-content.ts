import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const thinContent: AuditCheckDefinition = {
  name: 'thin_content',
  type: 'seo',
  priority: 'optional',
  description: 'Pages should have at least 300 words of content',
  displayName: 'Thin Content',
  displayNamePassed: 'Content Length',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Remove script and style elements before extracting text
    $('script, style, noscript').remove()

    const text = $('body').text().replace(/\s+/g, ' ').trim()
    const wordCount = text.split(' ').filter((w) => w.length > 0).length

    if (wordCount < 300) {
      return {
        status: 'warning',
        details: {
          message: `Page has only ${wordCount} words. Search engines prefer pages with 300+ words of meaningful content. Consider adding more descriptive text, FAQs, or explanations.`,
          wordCount,
        },
      }
    }

    return {
      status: 'passed',
      details: {
        message: `${wordCount} words`,
      },
    }
  },
}
