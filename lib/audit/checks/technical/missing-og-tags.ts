import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const missingOgTags: AuditCheckDefinition = {
  name: 'missing_og_tags',
  type: CheckType.Technical,
  priority: CheckPriority.Optional,
  description: 'Pages missing Open Graph meta tags for social sharing',
  displayName: 'Missing Open Graph Tags',
  displayNamePassed: 'Open Graph Tags',
  learnMoreUrl: 'https://ogp.me/',

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
        status: CheckStatus.Warning,
        details: {
          message: `Add ${missing.join(', ')} meta tags for better social media previews when your pages are shared on Facebook, LinkedIn, and other platforms.`,
          missing,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: { message: 'og:title, og:description, og:image all present' },
    }
  },
}
