import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const noFaqContent: AuditCheckDefinition = {
  name: 'no_faq_content',
  type: 'ai_readiness',
  priority: 'recommended',
  description: 'Check for FAQ schema or FAQ-style content',
  displayName: 'No FAQ Content',
  displayNamePassed: 'FAQ Content',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for FAQ schema
    const jsonLd = $('script[type="application/ld+json"]').text()
    const hasFaqSchema = jsonLd.includes('FAQPage') || jsonLd.includes('Question')

    // Check for FAQ-style content
    const hasFaqSection =
      $('[class*="faq"], [id*="faq"], h2:contains("FAQ"), h2:contains("Frequently")').length > 0

    if (hasFaqSchema) {
      return {
        status: 'passed',
        details: { message: 'FAQ schema found' },
      }
    }

    if (hasFaqSection) {
      return {
        status: 'passed',
        details: {
          message: 'FAQ section detected (consider adding FAQPage schema for rich results)',
        },
      }
    }

    return {
      status: 'warning',
      details: {
        message:
          'Consider adding FAQ content with FAQPage schema. FAQ sections help AI assistants answer questions about your product/service directly.',
      },
    }
  },
}
