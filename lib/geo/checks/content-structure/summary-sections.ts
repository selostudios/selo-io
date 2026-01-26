import * as cheerio from 'cheerio'
import type { GEOCheckDefinition, GEOCheckContext, CheckResult } from '@/lib/geo/types'

export const summarySections: GEOCheckDefinition = {
  name: 'summary_sections',
  category: 'content_structure',
  priority: 'recommended',
  description: 'TL;DR and summary sections help AI engines extract key takeaways',
  displayName: 'No Summary Section',
  displayNamePassed: 'Summary Section Present',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/featured-snippets',
  isSiteWide: false,

  async run(context: GEOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for summary-related headings
    const summaryHeadings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /^(tl;dr|tldr|summary|key takeaways|key points|in (a )?nutshell|quick summary|executive summary|conclusion)/i.test(text.trim())
    })

    // Check for HTML5 summary elements
    const summaryElements = $('summary').length

    // Check for blockquote or aside elements that might contain summaries
    const summaryBlocks = $('blockquote, aside').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /(summary|key point|takeaway)/i.test(text)
    })

    // Check for bullet points near summary headings (common pattern)
    let summaryListItems = 0
    summaryHeadings.each((_, heading) => {
      const nextElements = $(heading).nextAll().slice(0, 3)
      summaryListItems += nextElements.find('ul li, ol li').length
    })

    const indicators = []
    if (summaryHeadings.length > 0) {
      indicators.push(`${summaryHeadings.length} summary heading(s)`)
    }
    if (summaryElements > 0) {
      indicators.push(`${summaryElements} summary element(s)`)
    }
    if (summaryBlocks.length > 0) {
      indicators.push(`${summaryBlocks.length} summary block(s)`)
    }
    if (summaryListItems > 0) {
      indicators.push(`${summaryListItems} key point(s)`)
    }

    if (indicators.length === 0) {
      return {
        status: 'warning',
        details: {
          message: 'No summary section found. AI engines prioritize content with clear TL;DR or key takeaways for quick extraction.',
          fixGuidance: 'Add a "Summary" or "Key Takeaways" section with 3-5 bullet points of main insights.',
        },
      }
    } else {
      return {
        status: 'passed',
        details: {
          message: `Summary content found: ${indicators.join(', ')}`,
          indicators,
        },
      }
    }
  },
}
