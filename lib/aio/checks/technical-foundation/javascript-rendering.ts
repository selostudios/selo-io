import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const javascriptRendering: AIOCheckDefinition = {
  name: 'javascript_rendering',
  category: AIOCheckCategory.TechnicalFoundation,
  priority: CheckPriority.Recommended,
  description: 'Content should be available in initial HTML for reliable AI crawler access',
  displayName: 'JavaScript-Dependent Content',
  displayNamePassed: 'Server-Rendered Content',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Count text content in initial HTML
    const bodyText = $('body').text().trim()
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length

    // Check for common client-side rendering frameworks
    const frameworks = {
      react:
        context.html.includes('__NEXT_DATA__') ||
        context.html.includes('_reactRoot') ||
        $('#root').length > 0,
      vue: context.html.includes('v-cloak') || $('[v-app]').length > 0,
      angular: context.html.includes('ng-version') || $('[ng-app]').length > 0,
      svelte: context.html.includes('__SVELTE__'),
    }

    const detectedFrameworks = Object.entries(frameworks)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, detected]) => detected)
      .map(([name]) => name)

    // Check for SSR indicators
    const hasSSRIndicators =
      context.html.includes('__NEXT_DATA__') || // Next.js SSR
      context.html.includes('__NUXT__') || // Nuxt SSR
      context.html.includes('prerendered') // General SSR/SSG

    // Main content check
    if (wordCount < 50) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Very little content in initial HTML (${wordCount} words). AI crawlers may not see your content if it requires JavaScript execution.`,
          wordCount,
          detectedFrameworks,
          fixGuidance:
            'Implement server-side rendering (SSR) or static site generation (SSG) to ensure content is available in initial HTML.',
        },
      }
    } else if (wordCount < 200 && detectedFrameworks.length > 0 && !hasSSRIndicators) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Limited content in initial HTML (${wordCount} words). Framework detected (${detectedFrameworks.join(', ')}) but SSR not confirmed. AI crawlers may miss dynamically loaded content.`,
          wordCount,
          detectedFrameworks,
          fixGuidance:
            'Enable server-side rendering to ensure all content is available to AI crawlers.',
        },
      }
    } else {
      const renderingType = hasSSRIndicators ? 'Server-rendered' : 'Static HTML'
      return {
        status: CheckStatus.Passed,
        details: {
          message: `${renderingType} content available (${wordCount} words in initial HTML)`,
          wordCount,
          ...(detectedFrameworks.length > 0 && { detectedFrameworks }),
        },
      }
    }
  },
}
