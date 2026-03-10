import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

const MAX_IMAGE_SIZE_KB = 500
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024

export const oversizedImages: AuditCheckDefinition = {
  name: 'oversized_images',
  category: CheckCategory.Media,
  priority: CheckPriority.Optional,
  description: 'Images over 500KB affect page load speed',
  displayName: 'Oversized Images',
  displayNamePassed: 'Image Sizes',
  learnMoreUrl: 'https://web.dev/articles/optimize-cls#images_without_dimensions',
  fixGuidance:
    'Compress images or convert to modern formats (WebP, AVIF) to reduce file sizes below 500KB.',
  feedsScores: [ScoreDimension.Performance],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const baseUrl = new URL(context.url)
    const oversized: Array<{ src: string; sizeKb: number }> = []
    const checkedImages: string[] = []

    // Collect all image sources
    const imageSources: string[] = []
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src')
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href
          imageSources.push(absoluteUrl)
        } catch {
          // Invalid URL, skip
        }
      }
    })

    // Check each image size using HEAD requests
    for (const src of imageSources) {
      try {
        const response = await fetch(src, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'SeloBot/1.0 (Site Audit)',
          },
        })

        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          if (contentLength) {
            const sizeBytes = parseInt(contentLength, 10)
            checkedImages.push(src)

            if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
              const sizeKb = Math.round(sizeBytes / 1024)
              oversized.push({ src, sizeKb })
            }
          }
        }
      } catch {
        // Failed to check image, skip
      }
    }

    if (oversized.length > 0) {
      // Sort by size descending and format each image path with size
      const sorted = [...oversized].sort((a, b) => b.sizeKb - a.sizeKb)
      const imageList = sorted
        .slice(0, 10)
        .map((img) => {
          try {
            const pathname = new URL(img.src).pathname
            return `${pathname} (${img.sizeKb}KB)`
          } catch {
            return `${img.src} (${img.sizeKb}KB)`
          }
        })
        .join(', ')
      const suffix = sorted.length > 10 ? `, +${sorted.length - 10} more` : ''

      return {
        status: CheckStatus.Failed,
        details: {
          message: `${oversized.length} image${oversized.length === 1 ? '' : 's'} over ${MAX_IMAGE_SIZE_KB}KB: ${imageList}${suffix}`,
          count: oversized.length,
          images: sorted,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: undefined,
      },
    }
  },
}
