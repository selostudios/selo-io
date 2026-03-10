import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const mobileFriendly: AuditCheckDefinition = {
  name: 'mobile_friendly',
  category: CheckCategory.Performance,
  priority: CheckPriority.Recommended,
  description:
    'Mobile optimization ensures content is accessible on all devices and meets mobile-first indexing requirements.',
  displayName: 'Not Mobile-Friendly',
  displayNamePassed: 'Mobile-Friendly',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing',
  isSiteWide: false,
  fixGuidance:
    'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and use responsive CSS with media queries.',
  feedsScores: [ScoreDimension.Performance, ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
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
      const mobileSignals: string[] = []
      if (viewport) mobileSignals.push('viewport')
      if (hasMediaQueries) mobileSignals.push('media queries')
      if (appleWebApp || mobileOptimized) mobileSignals.push('mobile meta tags')

      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
        },
      }
    } else if (issues.length === 1) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: issues[0],
          issues,
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Mobile optimization issues: ${issues.join('; ')}`,
          issues,
        },
      }
    }
  },
}
