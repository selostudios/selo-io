import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const imagesMissingAlt: AuditCheckDefinition = {
  name: 'images_missing_alt',
  type: CheckType.SEO,
  priority: CheckPriority.Recommended,
  description: 'All images should have alt attributes',
  displayName: 'Images Missing Alt Text',
  displayNamePassed: 'Image Alt Text',
  learnMoreUrl:
    'https://developers.google.com/search/docs/appearance/google-images#use-descriptive-alt-text',

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
        },
      }
    }

    const totalImages = $('img').length
    return {
      status: CheckStatus.Passed,
      details: {
        message: totalImages > 0 ? `All ${totalImages} images have alt text` : 'No images found',
      },
    }
  },
}
