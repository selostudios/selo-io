import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const jsRenderedContent: AuditCheckDefinition = {
  name: 'js_rendered_content',
  type: 'ai_readiness',
  priority: 'critical',
  description: 'AI crawlers cannot execute JavaScript - content must be in initial HTML',
  displayName: 'JavaScript-Dependent Content',
  displayNamePassed: 'Server-Rendered Content',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
  isSiteWide: false,

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Remove script, style, and noscript tags for content analysis
    $('script, style, noscript, nav, header, footer').remove()

    // Get text content from body
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    const wordCount = bodyText.split(/\s+/).filter((word) => word.length > 0).length

    // Check for common SPA indicators
    const hasReactRoot = $('#root, #__next, [data-reactroot]').length > 0
    const hasVueApp = $('#app, [data-v-]').length > 0
    const hasAngularApp = $('[ng-app], [data-ng-app], app-root').length > 0
    const isSPA = hasReactRoot || hasVueApp || hasAngularApp

    // Count script tags
    const $original = cheerio.load(context.html)
    const scriptCount = $original('script').length
    const hasHeavyJS = scriptCount > 10

    // Check for meaningful content elements
    const hasMainContent =
      $('main, article, [role="main"], .content, #content, .post, .article').length > 0
    const paragraphCount = $('p').length
    const headingCount = $('h1, h2, h3, h4, h5, h6').length

    // Determine status based on content analysis
    if (wordCount >= 100 && (paragraphCount >= 2 || headingCount >= 1)) {
      // Good amount of server-rendered content
      return {
        status: 'passed',
        details: {
          message: `Page has ${wordCount} words of server-rendered content that AI crawlers can read.`,
          word_count: wordCount,
          paragraph_count: paragraphCount,
        },
      }
    }

    if (isSPA && wordCount < 50) {
      // Likely a client-rendered SPA with minimal initial content
      return {
        status: 'failed',
        details: {
          message: `Page appears to be a JavaScript SPA with only ${wordCount} words in initial HTML. AI crawlers like GPTBot cannot execute JavaScript and will see a nearly blank page. Implement server-side rendering (SSR) or static site generation (SSG).`,
          word_count: wordCount,
          is_spa: true,
        },
      }
    }

    if (wordCount < 50 && hasHeavyJS) {
      // Low content with heavy JavaScript
      return {
        status: 'failed',
        details: {
          message: `Page has only ${wordCount} words but ${scriptCount} script tags. Content may be rendered by JavaScript. AI crawlers will not see your content. Consider server-side rendering.`,
          word_count: wordCount,
          script_count: scriptCount,
        },
      }
    }

    if (wordCount < 100) {
      // Low content but not necessarily SPA
      return {
        status: 'warning',
        details: {
          message: `Page has only ${wordCount} words in initial HTML. If more content appears after JavaScript loads, AI crawlers may miss it. Verify important content is server-rendered.`,
          word_count: wordCount,
        },
      }
    }

    // Moderate content
    return {
      status: 'passed',
      details: {
        message: `Page has ${wordCount} words of server-rendered content.`,
        word_count: wordCount,
      },
    }
  },
}
