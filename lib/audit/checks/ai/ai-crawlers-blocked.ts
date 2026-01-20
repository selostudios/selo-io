import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const aiCrawlersBlocked: AuditCheckDefinition = {
  name: 'ai_crawlers_blocked',
  type: 'ai_readiness',
  priority: 'critical',
  description: 'Check if robots.txt blocks AI crawlers like GPTBot, ClaudeBot',
  displayName: 'AI Crawlers Blocked',
  displayNamePassed: 'AI Crawlers Allowed',
  learnMoreUrl: 'https://platform.openai.com/docs/gptbot',
  isSiteWide: true,

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
        return {
          status: 'passed',
          details: { message: 'No robots.txt found (AI crawlers allowed by default)' },
        }
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
          details: {
            message: `Your robots.txt blocks these AI crawlers: ${blocked.join(', ')}. This prevents AI assistants like ChatGPT and Claude from citing your content.`,
            blocked,
          },
        }
      }
      return {
        status: 'passed',
        details: { message: 'AI crawlers are allowed in robots.txt' },
      }
    } catch {
      return { status: 'passed' }
    }
  },
}
