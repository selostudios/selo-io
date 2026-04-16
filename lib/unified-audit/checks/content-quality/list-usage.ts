import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import { pluralize } from '@/lib/utils'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const listUsage: AuditCheckDefinition = {
  name: 'list_usage',
  category: CheckCategory.ContentQuality,
  priority: CheckPriority.Recommended,
  description: 'Bullet points and numbered lists help AI engines extract key information',
  displayName: 'No Lists',
  displayNamePassed: 'Lists Present',
  learnMoreUrl: 'https://web.dev/articles/content-structure',
  isSiteWide: false,
  fixGuidance:
    'Add bullet points for key takeaways, features, or steps. Lists improve content scannability.',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Remove non-content areas
    $('nav, header, footer, aside, script, style, noscript').remove()

    const unorderedLists = $('ul')
    const orderedLists = $('ol')
    const totalLists = unorderedLists.length + orderedLists.length

    const unorderedItems = $('ul li').length
    const orderedItems = $('ol li').length
    const totalItems = unorderedItems + orderedItems

    // Get word count for context
    const mainText = $('main, article, [role="main"], body').first().text()
    const wordCount = mainText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length

    if (totalLists === 0) {
      if (wordCount > 500) {
        return {
          status: CheckStatus.Warning,
          details: {
            message:
              'No lists found in substantial content. Lists help AI engines extract key points.',
            wordCount,
            fixGuidance:
              'Add bullet points for key takeaways, features, or steps. Lists improve content scannability.',
          },
        }
      } else {
        return {
          status: CheckStatus.Passed,
          details: {
            message: 'No lists found (acceptable for short content)',
            wordCount,
          },
        }
      }
    }

    // Calculate list density (items per 100 words)
    const listDensity = (totalItems / wordCount) * 100

    const details = {
      totalLists,
      unorderedLists: unorderedLists.length,
      orderedLists: orderedLists.length,
      totalItems,
      listDensity: Math.round(listDensity * 10) / 10,
    }

    // Check for well-structured lists
    const listsWithMultipleItems = $('ul, ol').filter((_, el) => {
      return $(el).find('> li').length >= 3
    }).length

    if (listsWithMultipleItems < totalLists * 0.5) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Found ${pluralize(totalLists, 'list')} but many have few items. Use lists for 3+ related points.`,
          ...details,
          fixGuidance:
            'Consolidate short lists or expand them to at least 3 items for better structure.',
        },
      }
    }

    if (totalLists >= 2 && totalItems >= 6) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          ...details,
        },
      }
    } else if (totalLists >= 1) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          ...details,
        },
      }
    } else {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Limited list usage: ${pluralize(totalLists, 'list')}. Consider adding more lists for key points.`,
          ...details,
        },
      }
    }
  },
}
