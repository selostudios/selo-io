import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const imagesMissingAlt: AuditCheckDefinition = {
  name: 'images_missing_alt',
  category: CheckCategory.Media,
  priority: CheckPriority.Recommended,
  description: 'All images should have alt attributes for accessibility and SEO',
  displayName: 'Images Missing Alt Text',
  displayNamePassed: 'Image Alt Text',
  learnMoreUrl:
    'https://developers.google.com/search/docs/appearance/google-images#use-descriptive-alt-text',
  fixGuidance:
    'Add descriptive alt="description" attributes to all <img> elements for accessibility and SEO.',
  feedsScores: [ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const imagesWithoutAlt: string[] = []

    $('img').each((_, el) => {
      const alt = $(el).attr('alt')
      if (alt === undefined) {
        const src = $(el).attr('src') || 'unknown'
        imagesWithoutAlt.push(src)
      }
    })

    if (imagesWithoutAlt.length > 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `${imagesWithoutAlt.length} image${imagesWithoutAlt.length === 1 ? '' : 's'} missing alt attribute. Add alt="description" to each <img> for accessibility and SEO.`,
          count: imagesWithoutAlt.length,
          images: imagesWithoutAlt.slice(0, 10),
        },
      }
    }

    const totalImages = $('img').length
    return {
      status: CheckStatus.Passed,
      details: {
        message: totalImages > 0 ? `All ${totalImages} images have alt text` : 'No images found',
        totalImages,
      },
    }
  },
}
