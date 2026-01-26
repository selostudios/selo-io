import type { GEOCheckDefinition, GEOCheckContext, CheckResult } from '@/lib/geo/types'

export const aiCrawlerAccess: GEOCheckDefinition = {
  name: 'ai_crawler_access',
  category: 'technical_foundation',
  priority: 'critical',
  description: 'Ensure AI crawlers like GPTBot, Claude-Web can access your site',
  displayName: 'AI Crawlers Blocked',
  displayNamePassed: 'AI Crawlers Allowed',
  learnMoreUrl: 'https://platform.openai.com/docs/gptbot',
  isSiteWide: true,

  async run(context: GEOCheckContext): Promise<CheckResult> {
    // This is a site-wide check - only meaningful on homepage
    const baseUrl = new URL(context.url)
    if (baseUrl.pathname !== '/' && baseUrl.pathname !== '') {
      return { status: 'passed' }
    }

    try {
      const robotsTxtUrl = `${baseUrl.origin}/robots.txt`
      const response = await fetch(robotsTxtUrl)
      if (!response.ok) {
        return {
          status: 'passed',
          details: { message: 'No robots.txt found (AI crawlers allowed by default)' },
        }
      }

      const text = await response.text()
      const aiCrawlers = [
        'GPTBot',
        'ChatGPT-User',
        'ClaudeBot',
        'Claude-Web',
        'anthropic-ai',
        'PerplexityBot',
        'Google-Extended',
        'Applebot-Extended',
      ]

      const blocked = aiCrawlers.filter((bot) => {
        // Check for explicit Disallow rules for this bot
        const pattern = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?Disallow:\\s*/`, 'i')
        return pattern.test(text)
      })

      if (blocked.length > 0) {
        return {
          status: 'failed',
          details: {
            message: `Your robots.txt blocks these AI crawlers: ${blocked.join(', ')}. This prevents AI engines from indexing and citing your content.`,
            blocked,
            fixGuidance: 'Remove or comment out Disallow rules for AI crawlers in your robots.txt file.',
          },
        }
      }

      return {
        status: 'passed',
        details: {
          message: `AI crawlers can access your site (${aiCrawlers.length} crawlers checked)`,
        },
      }
    } catch (error) {
      return {
        status: 'warning',
        details: {
          message: `Could not verify robots.txt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      }
    }
  },
}
