import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const aiCrawlersBlocked: AuditCheckDefinition = {
  name: 'ai_crawlers_blocked',
  type: 'ai_readiness',
  priority: 'critical',
  description: 'Check if robots.txt blocks AI crawlers like GPTBot, ClaudeBot',

  async run(context: CheckContext): Promise<CheckResult> {
    // This is a site-wide check - only meaningful on homepage
    const baseUrl = new URL(context.url)
    if (baseUrl.pathname !== '/' && baseUrl.pathname !== '') {
      return { status: 'passed' }
    }

    try {
      const robotsTxtUrl = `${baseUrl.origin}/robots.txt`
      const response = await fetch(robotsTxtUrl)
      if (!response.ok) {
        return { status: 'passed' } // No robots.txt means not blocked
      }

      const text = await response.text()
      const blockedBots = ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'ChatGPT-User', 'Anthropic-AI']
      const blocked = blockedBots.filter((bot) => {
        const pattern = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?Disallow:\\s*/`, 'i')
        return pattern.test(text)
      })

      if (blocked.length > 0) {
        return {
          status: 'failed',
          details: { message: `AI crawlers blocked: ${blocked.join(', ')}`, blocked },
        }
      }
      return { status: 'passed' }
    } catch {
      return { status: 'passed' }
    }
  },
}
