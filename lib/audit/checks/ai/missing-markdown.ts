import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingMarkdown: AuditCheckDefinition = {
  name: 'missing_markdown',
  type: 'ai_readiness',
  priority: 'optional',
  description: 'Markdown versions of pages improve AI crawler accessibility',
  displayName: 'Missing Markdown Alternatives',
  displayNamePassed: 'Markdown Alternatives',
  learnMoreUrl: 'https://llmstxt.org/',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url)
    const markdownEndpoints: string[] = []

    // Check common markdown file locations
    const pathsToCheck = [
      '/llms-full.txt', // Full markdown version from llms.txt standard
      '/README.md',
      '/docs.md',
      '/about.md',
      '/index.md',
    ]

    for (const path of pathsToCheck) {
      try {
        const url = new URL(path, baseUrl).href
        const response = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
        })

        if (response.ok) {
          markdownEndpoints.push(path)
        }
      } catch {
        // Failed to check, skip
      }
    }

    // Also check if any pages have .md alternatives
    const pagesWithMarkdown: string[] = []
    const pagesToCheck = context.allPages.slice(0, 10) // Check first 10 pages

    for (const page of pagesToCheck) {
      try {
        const pageUrl = new URL(page.url)
        // Try adding .md to the pathname
        const mdUrl = pageUrl.href.replace(/\/?$/, '.md')
        const response = await fetch(mdUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          // Make sure it's actually markdown, not an HTML page
          if (
            contentType.includes('text/markdown') ||
            contentType.includes('text/plain') ||
            contentType.includes('text/x-markdown')
          ) {
            pagesWithMarkdown.push(page.url)
          }
        }
      } catch {
        // Failed to check, skip
      }
    }

    const hasMarkdown = markdownEndpoints.length > 0 || pagesWithMarkdown.length > 0

    if (!hasMarkdown) {
      return {
        status: 'failed',
        details: {
          message:
            'No markdown alternatives found. Consider providing /llms-full.txt or .md versions of key pages to improve accessibility for AI crawlers and LLMs.',
        },
      }
    }

    const foundItems = [...markdownEndpoints, ...pagesWithMarkdown.map((p) => `${p} → .md`)]
    return {
      status: 'passed',
      details: {
        message: `Found ${foundItems.length} markdown endpoint${foundItems.length === 1 ? '' : 's'}: ${foundItems.slice(0, 3).join(', ')}${foundItems.length > 3 ? '...' : ''}`,
        endpoints: foundItems,
      },
    }
  },
}
