import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const imagesMissingAlt: AuditCheckDefinition = {
  name: 'images_missing_alt',
  type: 'seo',
  priority: 'recommended',
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
        status: 'failed',
        details: {
          message: `${imagesWithoutAlt.length} image${imagesWithoutAlt.length === 1 ? '' : 's'} missing alt attribute. Add alt="description" to each <img> for accessibility and SEO.`,
          count: imagesWithoutAlt.length,
        },
      }
    }

    const totalImages = $('img').length
    return {
      status: 'passed',
      details: {
        message: totalImages > 0 ? `All ${totalImages} images have alt text` : 'No images found',
      },
    }
  },
}
