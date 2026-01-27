import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const faqSection: AIOCheckDefinition = {
  name: 'faq_section',
  category: AIOCheckCategory.ContentStructure,
  priority: CheckPriority.Recommended,
  description: 'FAQ sections help AI engines extract Q&A pairs for direct answers',
  displayName: 'No FAQ Section',
  displayNamePassed: 'FAQ Section Present',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for FAQPage schema
    const hasFAQSchema = $('script[type="application/ld+json"]').filter((_, el) => {
      const content = $(el).html()
      return !!(content?.includes('"@type":"FAQPage"') || content?.includes('"@type": "FAQPage"'))
    }).length > 0

    // Check for FAQ-related headings
    const faqHeadings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /faq|frequently asked|questions|q&a|q & a/.test(text)
    }).length

    // Check for common FAQ patterns
    const dtElements = $('dt').length // Definition lists often used for FAQs
    const detailsElements = $('details summary').length // HTML5 details/summary for expandable FAQs

    const faqIndicators = []
    if (hasFAQSchema) faqIndicators.push('FAQPage schema')
    if (faqHeadings > 0) faqIndicators.push('FAQ heading')
    if (dtElements > 0) faqIndicators.push(`${dtElements} definition list items`)
    if (detailsElements > 0) faqIndicators.push(`${detailsElements} details/summary elements`)

    if (faqIndicators.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: 'No FAQ section detected. AI engines prioritize sites with Q&A content for direct answer citations.',
          fixGuidance: 'Add a FAQ section with common questions and detailed answers. Use FAQPage schema markup for best results.',
        },
      }
    } else if (hasFAQSchema) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `FAQ section with structured data: ${faqIndicators.join(', ')}`,
          indicators: faqIndicators,
        },
      }
    } else {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `FAQ content detected (${faqIndicators.join(', ')}) but missing FAQPage schema markup`,
          indicators: faqIndicators,
          fixGuidance: 'Add FAQPage structured data to help AI engines extract Q&A pairs.',
        },
      }
    }
  },
}
