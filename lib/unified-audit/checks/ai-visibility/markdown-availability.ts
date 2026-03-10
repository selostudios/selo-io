import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const markdownAvailability: AuditCheckDefinition = {
  name: 'markdown_availability',
  category: CheckCategory.AIVisibility,
  priority: CheckPriority.Optional,
  description: 'Markdown versions of pages improve AI crawler accessibility',
  displayName: 'Missing Markdown Alternatives',
  displayNamePassed: 'Markdown Alternatives Available',
  learnMoreUrl: 'https://llmstxt.org/',
  isSiteWide: false,
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const indicators: string[] = []

    // Check for llms.txt reference in HTML
    const links = $('a[href], link[href]')
    links.each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href.includes('llms.txt') || href.includes('llms-full.txt')) {
        indicators.push(`llms.txt reference found: ${href}`)
      }
      if (href.endsWith('.md') || href.includes('.md?')) {
        indicators.push(`Markdown link found: ${href}`)
      }
    })

    // Check for alternate link pointing to markdown
    const alternateLinks = $('link[rel="alternate"]')
    alternateLinks.each((_, el) => {
      const type = $(el).attr('type') || ''
      if (type.includes('markdown') || type.includes('text/plain')) {
        const href = $(el).attr('href') || ''
        indicators.push(`Alternate markdown link: ${href}`)
      }
    })

    // Check meta tags for llms.txt reference
    const metaTags = $('meta[name]')
    metaTags.each((_, el) => {
      const name = $(el).attr('name') || ''
      const content = $(el).attr('content') || ''
      if (name.toLowerCase().includes('llms') || content.includes('llms.txt')) {
        indicators.push(`Meta reference to llms.txt: ${content}`)
      }
    })

    if (indicators.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'No markdown alternatives found. Consider providing /llms-full.txt or .md versions of key pages to improve accessibility for AI crawlers and LLMs.',
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: `Found ${indicators.length} markdown indicator${indicators.length === 1 ? '' : 's'}: ${indicators.slice(0, 3).join(', ')}${indicators.length > 3 ? '...' : ''}`,
        indicators,
      },
    }
  },
}
