import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const internalLinking: AIOCheckDefinition = {
  name: 'internal_linking',
  category: AIOCheckCategory.ContentQuality,
  priority: CheckPriority.Recommended,
  description: 'Internal links help AI engines discover and understand content relationships',
  displayName: 'Poor Internal Linking',
  displayNamePassed: 'Good Internal Linking',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
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
            'No internal links found. Internal linking helps AI engines discover related content.',
          ...details,
          fixGuidance: 'Add 2-5 contextual links to related pages within your content.',
        },
      }
    } else if (contextualInternalLinks.length === 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Found ${internalLinks.length} internal link(s) but none are contextual (within content). Add links within paragraphs.`,
          ...details,
          fixGuidance: 'Add contextual internal links within article text to related pages.',
        },
      }
    } else if (contextualInternalLinks.length < 2 && wordCount > 500) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Limited internal linking (${contextualInternalLinks.length} contextual links in ${wordCount} words). Add more links to related content.`,
          ...details,
          fixGuidance:
            'Add 2-5 contextual links to related pages (roughly 1 link per 200-300 words).',
        },
      }
    } else if (internalLinkDensity > 3) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `High internal link density (${Math.round(internalLinkDensity)}%). Avoid over-linking.`,
          ...details,
          fixGuidance: 'Reduce internal links to 1-3% density (1 link per 200-300 words).',
        },
      }
    } else {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `Good internal linking: ${contextualInternalLinks.length} contextual link(s) (${Math.round(internalLinkDensity)}% density)`,
          ...details,
        },
      }
    }
  },
}
