import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import { pluralize } from '@/lib/utils'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const internalLinking: AuditCheckDefinition = {
  name: 'internal_linking',
  category: CheckCategory.Links,
  priority: CheckPriority.Recommended,
  description:
    'Internal links help search engines and AI discover and understand content relationships',
  displayName: 'Poor Internal Linking',
  displayNamePassed: 'Good Internal Linking',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable',
  fixGuidance: 'Add 2-5 contextual links to related pages within your content.',
  feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Remove non-content areas
    $('nav, header, footer, aside').remove()

    // Get all links
    const allLinks = $('a[href]')
    const currentDomain = new URL(context.url).hostname

    // Categorize links
    const internalLinks = allLinks.filter((_, el) => {
      const href = $(el).attr('href') || ''

      // Relative links are internal
      if (!href.startsWith('http')) {
        return (
          href.length > 0 &&
          !href.startsWith('#') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:')
        )
      }

      // Absolute links - check domain
      try {
        const linkDomain = new URL(href).hostname
        return linkDomain === currentDomain
      } catch {
        return false
      }
    })

    const externalLinks = allLinks.filter((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href.startsWith('http')) return false

      try {
        const linkDomain = new URL(href).hostname
        return linkDomain !== currentDomain
      } catch {
        return false
      }
    })

    // Get word count for context
    const mainText = $('main, article, [role="main"], body').first().text()
    const wordCount = mainText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length

    // Calculate linking metrics
    const internalLinkDensity = wordCount > 0 ? (internalLinks.length / wordCount) * 100 : 0

    // Check for contextual internal links (within paragraphs/article content)
    const contextualInternalLinks = $('p a, article a, main a').filter((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href.startsWith('http')) {
        return href.length > 0 && !href.startsWith('#') && !href.startsWith('mailto:')
      }
      try {
        return new URL(href).hostname === currentDomain
      } catch {
        return false
      }
    })

    const details = {
      internalLinks: internalLinks.length,
      contextualInternalLinks: contextualInternalLinks.length,
      externalLinks: externalLinks.length,
      internalLinkDensity: Math.round(internalLinkDensity * 10) / 10,
      wordCount,
    }

    if (internalLinks.length === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message:
            'No internal links found. Internal linking helps search engines and AI discover related content.',
          ...details,
        },
      }
    } else if (contextualInternalLinks.length === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Found ${pluralize(internalLinks.length, 'internal link')} but none are contextual (within content). Add links within paragraphs.`,
          ...details,
        },
      }
    } else if (contextualInternalLinks.length < 2 && wordCount > 500) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Limited internal linking (${contextualInternalLinks.length} contextual links in ${wordCount} words). Add more links to related content.`,
          ...details,
        },
      }
    } else if (internalLinkDensity > 3) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `High internal link density (${Math.round(internalLinkDensity)}%). Avoid over-linking.`,
          ...details,
        },
      }
    } else {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          ...details,
        },
      }
    }
  },
}
