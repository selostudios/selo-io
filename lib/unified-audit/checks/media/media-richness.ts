import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import { pluralize } from '@/lib/utils'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const mediaRichness: AuditCheckDefinition = {
  name: 'media_richness',
  category: CheckCategory.Media,
  priority: CheckPriority.Recommended,
  description: 'Images with descriptive alt text help AI engines understand visual content',
  displayName: 'No Media',
  displayNamePassed: 'Media-Rich Content',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/google-images',
  fixGuidance:
    'Add relevant images, diagrams, or videos to illustrate key concepts. Use descriptive alt text (5-15 words).',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Remove non-content areas
    $('nav, header, footer, aside, script, style, noscript').remove()

    const images = $('img')
    const videos = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]')
    const totalMedia = images.length + videos.length

    // Get word count for context
    const mainText = $('main, article, [role="main"], body').first().text()
    const wordCount = mainText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length

    if (totalMedia === 0) {
      if (wordCount > 800) {
        return {
          status: CheckStatus.Warning,
          details: {
            message:
              'No images or videos found in long-form content. Visual aids improve engagement and understanding.',
            wordCount,
          },
        }
      } else {
        return {
          status: CheckStatus.Passed,
          details: {
            message: 'No media (acceptable for short content)',
            wordCount,
          },
        }
      }
    }

    // Check image alt text quality
    const imagesWithAlt = images.filter((_, el) => {
      const alt = $(el).attr('alt')
      return alt !== undefined && alt.trim().length > 0
    })

    const imagesWithGoodAlt = images.filter((_, el) => {
      const alt = $(el).attr('alt')
      if (!alt) return false
      const words = alt.trim().split(/\s+/)
      // Good alt text: 5-15 words, descriptive
      return words.length >= 5 && words.length <= 20
    })

    const altTextCoverage = images.length > 0 ? (imagesWithAlt.length / images.length) * 100 : 100
    const goodAltCoverage = images.length > 0 ? (imagesWithGoodAlt.length / images.length) * 100 : 0

    // Calculate media density (media per 100 words)
    const mediaDensity = wordCount > 0 ? (totalMedia / wordCount) * 100 : 0

    const details = {
      totalMedia,
      images: images.length,
      videos: videos.length,
      imagesWithAlt: imagesWithAlt.length,
      imagesWithGoodAlt: imagesWithGoodAlt.length,
      altTextCoverage: Math.round(altTextCoverage),
      mediaDensity: Math.round(mediaDensity * 10) / 10,
    }

    if (altTextCoverage < 50) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Found ${pluralize(images.length, 'image')} but only ${Math.round(altTextCoverage)}% have alt text. AI engines need descriptions to understand visual content.`,
          ...details,
        },
      }
    } else if (goodAltCoverage < 50) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Media present (${totalMedia} items) but alt text could be more descriptive (only ${Math.round(goodAltCoverage)}% have detailed descriptions)`,
          ...details,
        },
      }
    } else {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          ...details,
        },
      }
    }
  },
}
