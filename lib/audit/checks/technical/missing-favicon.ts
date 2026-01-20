import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingFavicon: AuditCheckDefinition = {
  name: 'missing_favicon',
  type: 'technical',
  priority: 'optional',
  description: 'Pages without a favicon link',
  displayName: 'Missing Favicon',
  displayNamePassed: 'Favicon',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/favicon-in-search',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href')

    if (!favicon) {
      return {
        status: 'warning',
        details: {
          message:
            'Add a favicon with <link rel="icon" href="/favicon.ico">. Favicons appear in browser tabs, bookmarks, and Google search results.',
        },
      }
    }

    return {
      status: 'passed',
      details: { message: favicon },
    }
  },
}
