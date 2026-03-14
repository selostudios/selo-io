import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const jsRendering: AuditCheckDefinition = {
  name: 'js_rendering',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Critical,
  description:
    'AI and search engine crawlers may not execute JavaScript — content must be in initial HTML',
  displayName: 'JavaScript-Dependent Content',
  displayNamePassed: 'Server-Rendered Content',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
  isSiteWide: false,
  fixGuidance:
    'Implement server-side rendering (SSR) or static site generation (SSG) to ensure content is available in initial HTML without JavaScript execution.',
  feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const $original = cheerio.load(context.html)

    // Detect frameworks before removing elements
    const frameworks = detectFrameworks(context.html, $original)

    // Check for SSR indicators
    const hasSSRIndicators =
      context.html.includes('__NEXT_DATA__') ||
      context.html.includes('__NUXT__') ||
      context.html.includes('prerendered')

    // Remove non-content elements for word counting
    $('script, style, noscript, nav, header, footer').remove()

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length

    // Count structural elements
    const paragraphCount = $('p').length
    const headingCount = $('h1, h2, h3, h4, h5, h6').length
    const scriptCount = $original('script').length

    const isSPA = frameworks.length > 0
    const hasHeavyJS = scriptCount > 10

    // Good server-rendered content: 100+ words with structural elements
    if (wordCount >= 100 && (paragraphCount >= 2 || headingCount >= 1)) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          wordCount,
          paragraphCount,
          headingCount,
          ...(frameworks.length > 0 && { detectedFrameworks: frameworks }),
        },
      }
    }

    // SPA with very little content — critical issue
    if (isSPA && wordCount < 50) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Page appears to be a JavaScript SPA with only ${wordCount} words in initial HTML. AI crawlers like GPTBot cannot execute JavaScript and will see a nearly blank page. Implement server-side rendering (SSR) or static site generation (SSG).`,
          wordCount,
          isSPA: true,
          detectedFrameworks: frameworks,
          scriptCount,
        },
      }
    }

    // Low content with heavy JavaScript — likely JS-dependent
    if (wordCount < 50 && hasHeavyJS) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Page has only ${wordCount} words but ${scriptCount} script tags. Content may be rendered by JavaScript. AI crawlers will not see your content. Consider server-side rendering.`,
          wordCount,
          scriptCount,
          ...(frameworks.length > 0 && { detectedFrameworks: frameworks }),
        },
      }
    }

    // Low content with framework but SSR not confirmed
    if (wordCount < 200 && frameworks.length > 0 && !hasSSRIndicators) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Limited content in initial HTML (${wordCount} words). Framework detected (${frameworks.join(', ')}) but SSR not confirmed. AI crawlers may miss dynamically loaded content.`,
          wordCount,
          detectedFrameworks: frameworks,
        },
      }
    }

    // Low content generally
    if (wordCount < 50) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Page has only ${wordCount} words in initial HTML. If more content appears after JavaScript loads, AI crawlers may miss it. Verify important content is server-rendered.`,
          wordCount,
        },
      }
    }

    // Moderate content — pass
    const renderingType = hasSSRIndicators ? 'Server-rendered' : 'Static HTML'
    return {
      status: CheckStatus.Passed,
      details: {
        message: `${renderingType} content available (${wordCount} words in initial HTML)`,
        wordCount,
        ...(frameworks.length > 0 && { detectedFrameworks: frameworks }),
      },
    }
  },
}

function detectFrameworks(html: string, $: cheerio.CheerioAPI): string[] {
  const detected: string[] = []

  // React / Next.js
  if (
    html.includes('__NEXT_DATA__') ||
    html.includes('_reactRoot') ||
    $('#root').length > 0 ||
    $('#__next').length > 0 ||
    $('[data-reactroot]').length > 0
  ) {
    detected.push('React')
  }

  // Vue / Nuxt
  if (
    html.includes('v-cloak') ||
    html.includes('__NUXT__') ||
    $('[v-app]').length > 0 ||
    $('[data-v-]').length > 0
  ) {
    detected.push('Vue')
  }

  // Angular
  if (
    html.includes('ng-version') ||
    $('[ng-app]').length > 0 ||
    $('[data-ng-app]').length > 0 ||
    $('app-root').length > 0
  ) {
    detected.push('Angular')
  }

  // Svelte
  if (html.includes('__SVELTE__') || html.includes('svelte-')) {
    detected.push('Svelte')
  }

  return detected
}
