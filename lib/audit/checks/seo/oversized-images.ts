import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

const MAX_IMAGE_SIZE_KB = 500
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024

export const oversizedImages: AuditCheckDefinition = {
  name: 'oversized_images',
  type: CheckType.SEO,
  priority: CheckPriority.Optional,
  description: 'Images over 500KB affect page load speed',
  displayName: 'Oversized Images',
  displayNamePassed: 'Image Sizes',
  learnMoreUrl: 'https://web.dev/articles/optimize-cls#images_without_dimensions',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const baseUrl = new URL(context.url)
    const oversizedImages: Array<{ src: string; sizeKb: number }> = []
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
              oversizedImages.push({ src, sizeKb })
            }
          }
        }
      } catch {
        // Failed to check image, skip
      }
    }

    if (oversizedImages.length > 0) {
      const largestImage = oversizedImages.reduce((a, b) => (a.sizeKb > b.sizeKb ? a : b))
      return {
        status: CheckStatus.Failed,
        details: {
          message: `${oversizedImages.length} image${oversizedImages.length === 1 ? '' : 's'} over ${MAX_IMAGE_SIZE_KB}KB. Largest: ${largestImage.sizeKb}KB. Compress images or use modern formats (WebP, AVIF) for faster load times.`,
          count: oversizedImages.length,
          images: oversizedImages.slice(0, 5), // Limit to first 5
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message:
          checkedImages.length > 0
            ? `All ${checkedImages.length} images are under ${MAX_IMAGE_SIZE_KB}KB`
            : 'No images found to check',
      },
    }
  },
}
