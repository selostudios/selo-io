import * as cheerio from 'cheerio'
import type { GEOCheckDefinition, GEOCheckContext, CheckResult } from '@/lib/geo/types'

export const contentAccessibility: GEOCheckDefinition = {
  name: 'content_accessibility',
  category: 'technical_foundation',
  priority: 'recommended',
  description: 'Alt text and semantic HTML help AI engines understand non-text content',
  displayName: 'Poor Accessibility',
  displayNamePassed: 'Good Accessibility',
  learnMoreUrl: 'https://web.dev/articles/accessibility',
  isSiteWide: false,

  async run(context: GEOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const issues: string[] = []
    const goodPractices: string[] = []

    // Check images for alt text
    const images = $('img')
    const imagesWithoutAlt = images.filter((_, el) => {
      const alt = $(el).attr('alt')
      return alt === undefined || alt.trim() === ''
    }).length

    if (images.length > 0) {
      const altTextCoverage = ((images.length - imagesWithoutAlt) / images.length) * 100
      if (altTextCoverage < 50) {
        issues.push(`${imagesWithoutAlt} of ${images.length} images missing alt text (${altTextCoverage.toFixed(0)}% coverage)`)
      } else if (altTextCoverage < 100) {
        issues.push(`${imagesWithoutAlt} of ${images.length} images missing alt text`)
      } else {
        goodPractices.push(`All ${images.length} images have alt text`)
      }
    }

    // Check for ARIA landmarks
    const ariaLandmarks = $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').length
    if (ariaLandmarks > 0) {
      goodPractices.push(`${ariaLandmarks} ARIA landmarks found`)
    } else {
      issues.push('No ARIA landmarks or semantic elements for page structure')
    }

    // Check for proper heading hierarchy
    const h1Count = $('h1').length
    if (h1Count === 0) {
      issues.push('No H1 heading found')
    } else if (h1Count > 1) {
      issues.push(`Multiple H1 headings (${h1Count})`)
    } else {
      goodPractices.push('Single H1 heading')
    }

    // Check for skip links (advanced accessibility)
    const skipLinks = $('a[href^="#"]').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return text.includes('skip') && (text.includes('content') || text.includes('main'))
    }).length
    if (skipLinks > 0) {
      goodPractices.push('Skip navigation links present')
    }

    // Check for lang attribute
    const lang = $('html').attr('lang')
    if (!lang) {
      issues.push('Missing lang attribute on <html> tag')
    } else {
      goodPractices.push(`Language declared (${lang})`)
    }

    if (issues.length === 0) {
      return {
        status: 'passed',
        details: {
          message: `Excellent accessibility: ${goodPractices.join(', ')}`,
          goodPractices,
        },
      }
    } else if (issues.length <= 2) {
      return {
        status: 'warning',
        details: {
          message: `Accessibility could be improved: ${issues.join('; ')}`,
          issues,
          goodPractices,
          fixGuidance: 'Add descriptive alt text to images and ensure proper heading hierarchy.',
        },
      }
    } else {
      return {
        status: 'failed',
        details: {
          message: `Multiple accessibility issues: ${issues.join('; ')}`,
          issues,
          fixGuidance: 'Implement alt text for all images, use semantic HTML, and add proper ARIA landmarks.',
        },
      }
    }
  },
}
