import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingOgTags: AuditCheckDefinition = {
  name: 'missing_og_tags',
  type: 'technical',
  priority: 'optional',
  description: 'Pages missing Open Graph meta tags for social sharing',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const ogTitle = $('meta[property="og:title"]').attr('content')
    const ogDescription = $('meta[property="og:description"]').attr('content')
    const ogImage = $('meta[property="og:image"]').attr('content')

    const missing: string[] = []
    if (!ogTitle) missing.push('og:title')
    if (!ogDescription) missing.push('og:description')
    if (!ogImage) missing.push('og:image')

    if (missing.length > 0) {
      return {
        status: 'warning',
        details: {
          message: `Missing Open Graph tags: ${missing.join(', ')}`,
          missing,
        },
      }
    }

    return { status: 'passed' }
  },
}
