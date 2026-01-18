import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const noFaqContent: AuditCheckDefinition = {
  name: 'no_faq_content',
  type: 'ai_readiness',
  priority: 'recommended',
  description: 'Check for FAQ schema or FAQ-style content',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for FAQ schema
    const jsonLd = $('script[type="application/ld+json"]').text()
    const hasFaqSchema = jsonLd.includes('FAQPage') || jsonLd.includes('Question')

    // Check for FAQ-style content
    const hasFaqSection =
      $('[class*="faq"], [id*="faq"], h2:contains("FAQ"), h2:contains("Frequently")').length > 0

    if (hasFaqSchema || hasFaqSection) {
      return { status: 'passed' }
    }

    return {
      status: 'warning',
      details: { message: 'No FAQ content or schema detected' },
    }
  },
}
