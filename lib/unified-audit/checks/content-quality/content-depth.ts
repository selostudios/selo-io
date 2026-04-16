import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const contentDepth: AuditCheckDefinition = {
  name: 'content_depth',
  category: CheckCategory.ContentQuality,
  priority: CheckPriority.Recommended,
  description: 'Sufficient content depth demonstrates expertise and comprehensive coverage',
  displayName: 'Thin Content',
  displayNamePassed: 'Substantial Content',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  isSiteWide: false,
  fixGuidance:
    'Expand content to at least 800-1000 words with detailed explanations, examples, and insights.',
  feedsScores: [ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Get main content text (exclude nav, header, footer, aside)
    $('nav, header, footer, aside, script, style, noscript').remove()
    const mainText = $('main, article, [role="main"], body').first().text()

    const words = mainText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
    const wordCount = words.length

    // Tiered thresholds: <300 fail, 300-800 warning, 800-1500 pass, >1500 excellent
    if (wordCount < 300) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Very thin content (${wordCount} words). AI engines prioritize comprehensive content with depth and detail.`,
          wordCount,
          fixGuidance:
            'Expand content to at least 800-1000 words with detailed explanations, examples, and insights.',
        },
      }
    } else if (wordCount < 800) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Moderate content depth (${wordCount} words). Consider adding more detail for better AI engine visibility.`,
          wordCount,
          fixGuidance:
            'Expand to 1000+ words with additional context, examples, and expert insights.',
        },
      }
    } else if (wordCount < 1500) {
      return {
        status: CheckStatus.Passed,
        details: {
          wordCount,
        },
      }
    } else {
      return {
        status: CheckStatus.Passed,
        details: {
          wordCount,
        },
      }
    }
  },
}
