import * as cheerio from 'cheerio'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const citationFormat: AIOCheckDefinition = {
  name: 'citation_format',
  category: 'content_structure',
  priority: 'recommended',
  description: 'Proper source attribution increases trustworthiness for AI engines',
  displayName: 'No Citation Format',
  displayNamePassed: 'Citations Present',
  learnMoreUrl: 'https://web.dev/articles/trust-and-safety',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Check for external links to authoritative sources
    const externalLinks = $('a[href^="http"]').filter((_, el) => {
      const href = $(el).attr('href') || ''
      const currentDomain = new URL(context.url).hostname
      try {
        const linkDomain = new URL(href).hostname
        return linkDomain !== currentDomain
      } catch {
        return false
      }
    })

    // Check for academic/authoritative domains
    const authoritativeDomains = ['.edu', '.gov', '.org', 'doi.org', 'arxiv.org', 'pubmed', 'scholar.google']
    const authoritativeLinks = externalLinks.filter((_, el) => {
      const href = $(el).attr('href') || ''
      return authoritativeDomains.some(domain => href.includes(domain))
    })

    // Check for citation-related elements
    const citationElements = $('cite, blockquote[cite]').length

    // Check for reference sections
    const referenceHeadings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /^(references|sources|citations|bibliography|further reading|works cited)/i.test(text.trim())
    })

    // Check for footnote/superscript citation markers
    const citationMarkers = $('sup a, a.footnote, [id^="fn"], [id^="ref"]').length

    const indicators = []
    if (authoritativeLinks.length > 0) {
      indicators.push(`${authoritativeLinks.length} authoritative source link(s)`)
    }
    if (externalLinks.length > authoritativeLinks.length) {
      indicators.push(`${externalLinks.length - authoritativeLinks.length} additional external link(s)`)
    }
    if (citationElements > 0) {
      indicators.push(`${citationElements} citation element(s)`)
    }
    if (referenceHeadings.length > 0) {
      indicators.push('reference section')
    }
    if (citationMarkers > 0) {
      indicators.push(`${citationMarkers} citation marker(s)`)
    }

    if (authoritativeLinks.length === 0 && citationElements === 0 && referenceHeadings.length === 0) {
      return {
        status: 'warning',
        details: {
          message: 'No citations or source links found. AI engines prioritize content with clear source attribution.',
          externalLinks: externalLinks.length,
          fixGuidance: 'Add links to authoritative sources (research papers, .edu/.gov sites) and use <cite> tags for quotes.',
        },
      }
    } else if (authoritativeLinks.length >= 3 || referenceHeadings.length > 0) {
      return {
        status: 'passed',
        details: {
          message: `Strong citation format: ${indicators.join(', ')}`,
          indicators,
          authoritativeLinks: authoritativeLinks.length,
        },
      }
    } else {
      return {
        status: 'warning',
        details: {
          message: `Some citations found (${indicators.join(', ')}) but could be improved with more authoritative sources`,
          indicators,
          authoritativeLinks: authoritativeLinks.length,
          fixGuidance: 'Link to more authoritative sources (.edu, .gov, research papers) to strengthen credibility.',
        },
      }
    }
  },
}
