import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const mixedContent: AuditCheckDefinition = {
  name: 'mixed_content',
  type: 'technical',
  priority: 'recommended',
  description: 'HTTP resources on HTTPS pages cause security warnings',
  displayName: 'Mixed Content',
  displayNamePassed: 'Secure Resources',
  learnMoreUrl: 'https://web.dev/articles/what-is-mixed-content',

  async run(context: CheckContext): Promise<CheckResult> {
    const pageUrl = new URL(context.url)

    // Only check HTTPS pages - HTTP pages can't have mixed content issues
    if (pageUrl.protocol !== 'https:') {
      return {
        status: 'passed',
        details: {
          message: 'Page is served over HTTP (mixed content check not applicable)',
        },
      }
    }

    const $ = cheerio.load(context.html)
    const insecureResources: Array<{ type: string; url: string }> = []

    // Check various resource types for HTTP URLs
    const resourceSelectors = [
      { selector: 'img[src]', attr: 'src', type: 'image' },
      { selector: 'script[src]', attr: 'src', type: 'script' },
      { selector: 'link[href]', attr: 'href', type: 'stylesheet' },
      { selector: 'iframe[src]', attr: 'src', type: 'iframe' },
      { selector: 'video[src]', attr: 'src', type: 'video' },
      { selector: 'audio[src]', attr: 'src', type: 'audio' },
      { selector: 'source[src]', attr: 'src', type: 'media source' },
      { selector: 'object[data]', attr: 'data', type: 'object' },
      { selector: 'embed[src]', attr: 'src', type: 'embed' },
    ]

    for (const { selector, attr, type } of resourceSelectors) {
      $(selector).each((_, el) => {
        const url = $(el).attr(attr)
        if (url && url.startsWith('http://')) {
          insecureResources.push({ type, url })
        }
      })
    }

    // Also check inline styles for url() with http://
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') || ''
      const httpUrlMatch = style.match(/url\s*\(\s*['"]?(http:\/\/[^'")]+)['"]?\s*\)/gi)
      if (httpUrlMatch) {
        for (const match of httpUrlMatch) {
          const urlMatch = match.match(/http:\/\/[^'")]+/)
          if (urlMatch) {
            insecureResources.push({ type: 'inline style', url: urlMatch[0] })
          }
        }
      }
    })

    if (insecureResources.length > 0) {
      const typeCount = new Map<string, number>()
      for (const resource of insecureResources) {
        typeCount.set(resource.type, (typeCount.get(resource.type) || 0) + 1)
      }
      const summary = Array.from(typeCount.entries())
        .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
        .join(', ')

      return {
        status: 'failed',
        details: {
          message: `${insecureResources.length} insecure HTTP resource${insecureResources.length === 1 ? '' : 's'} on HTTPS page (${summary}). Update URLs to HTTPS to prevent browser warnings and blocked content.`,
          count: insecureResources.length,
          resources: insecureResources.slice(0, 5), // Limit to first 5
        },
      }
    }

    return {
      status: 'passed',
      details: {
        message: 'All resources loaded securely over HTTPS',
      },
    }
  },
}
