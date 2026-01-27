import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const mobileFriendly: AIOCheckDefinition = {
  name: 'mobile_friendly',
  category: AIOCheckCategory.TechnicalFoundation,
  priority: CheckPriority.Recommended,
  description: 'Mobile optimization ensures AI engines can access content on all devices',
  displayName: 'Not Mobile-Friendly',
  displayNamePassed: 'Mobile-Friendly',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const issues: string[] = []

    // Check for viewport meta tag
    const viewport = $('meta[name="viewport"]').attr('content')
    if (!viewport) {
      issues.push('Missing viewport meta tag')
    } else if (!viewport.includes('width=device-width')) {
      issues.push('Viewport does not include width=device-width')
    }

    // Check for mobile-specific meta tags
    const appleWebApp = $('meta[name="apple-mobile-web-app-capable"]').length > 0
    const mobileOptimized = $('meta[name="MobileOptimized"]').length > 0

    // Check for responsive CSS indicators
    const hasMediaQueries = context.html.includes('@media') || context.html.includes('media=')

    // Check for fixed-width layouts (common mobile-unfriendly pattern)
    const hasFixedWidth = /width:\s*\d{4,}px/.test(context.html) // 1000px+ fixed widths
    if (hasFixedWidth) {
      issues.push('Page may use fixed-width layout (not responsive)')
    }

    if (issues.length === 0) {
      const mobileSignals = []
      if (viewport) mobileSignals.push('viewport')
      if (hasMediaQueries) mobileSignals.push('media queries')
      if (appleWebApp || mobileOptimized) mobileSignals.push('mobile meta tags')

      return {
        status: CheckStatus.Passed,
        details: {
          message: `Mobile-friendly (${mobileSignals.join(', ')})`,
          viewport,
        },
      }
    } else if (issues.length === 1) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: issues[0],
          fixGuidance: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> section.',
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Mobile optimization issues: ${issues.join('; ')}`,
          issues,
          fixGuidance: 'Implement responsive design with viewport meta tag and CSS media queries.',
        },
      }
    }
  },
}
