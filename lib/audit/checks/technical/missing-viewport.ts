import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingViewport: AuditCheckDefinition = {
  name: 'missing_viewport',
  type: 'technical',
  priority: 'recommended',
  description: 'Pages without viewport meta tag for mobile-friendliness',
  displayName: 'Missing Viewport Meta Tag',
  displayNamePassed: 'Viewport Meta Tag',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing#viewport',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const viewport = $('meta[name="viewport"]').attr('content')

    if (!viewport) {
      return {
        status: 'warning',
        details: {
          message:
            'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> for proper mobile display. Without this, your site may not render correctly on mobile devices.',
        },
      }
    }

    return {
      status: 'passed',
      details: { message: viewport },
    }
  },
}
