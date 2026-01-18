import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const thinContent: AuditCheckDefinition = {
  name: 'thin_content',
  type: 'seo',
  priority: 'optional',
  description: 'Pages should have at least 300 words of content',

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
          message: `Only ${wordCount} words (recommended: 300+)`,
          wordCount,
        },
      }
    }

    return { status: 'passed' }
  },
}
