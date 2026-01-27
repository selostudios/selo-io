import * as cheerio from 'cheerio'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const contentDepth: AIOCheckDefinition = {
  name: 'content_depth',
  category: 'content_quality',
  priority: 'recommended',
  description: 'Sufficient content depth demonstrates expertise and comprehensive coverage',
  displayName: 'Thin Content',
  displayNamePassed: 'Substantial Content',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Get main content text (exclude nav, header, footer, aside)
    $('nav, header, footer, aside, script, style, noscript').remove()
    const mainText = $('main, article, [role="main"], body').first().text()

    const words = mainText.trim().split(/\s+/).filter(w => w.length > 0)
    const wordCount = words.length

    // Thresholds based on content type heuristics
    // Blog post / Article: 300+ words minimum, 1000+ ideal
    // Product page: 200+ words minimum
    // Landing page: 500+ words minimum

    if (wordCount < 300) {
      return {
        status: 'failed',
        details: {
          message: `Very thin content (${wordCount} words). AI engines prioritize comprehensive content with depth and detail.`,
          wordCount,
          fixGuidance: 'Expand content to at least 800-1000 words with detailed explanations, examples, and insights.',
        },
      }
    } else if (wordCount < 800) {
      return {
        status: 'warning',
        details: {
          message: `Moderate content depth (${wordCount} words). Consider adding more detail for better AI engine visibility.`,
          wordCount,
          fixGuidance: 'Expand to 1000+ words with additional context, examples, and expert insights.',
        },
      }
    } else if (wordCount < 1500) {
      return {
        status: 'passed',
        details: {
          message: `Good content depth (${wordCount} words)`,
          wordCount,
        },
      }
    } else {
      return {
        status: 'passed',
        details: {
          message: `Excellent content depth (${wordCount} words)`,
          wordCount,
        },
      }
    }
  },
}
