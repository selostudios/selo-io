import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type {
  AICrawlerBreakdown,
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
} from '../../types'

interface BotDefinition {
  name: string
  userAgent: string
  owner: string
  tier: 'critical' | 'important' | 'secondary'
}

const AI_BOTS: BotDefinition[] = [
  // Critical — blocking these means major AI platforms cannot cite your content
  { name: 'GPTBot', userAgent: 'GPTBot', owner: 'OpenAI', tier: 'critical' },
  { name: 'ClaudeBot', userAgent: 'ClaudeBot', owner: 'Anthropic', tier: 'critical' },
  { name: 'PerplexityBot', userAgent: 'PerplexityBot', owner: 'Perplexity', tier: 'critical' },

  // Important — significant AI crawlers
  { name: 'GoogleExtended', userAgent: 'GoogleExtended', owner: 'Google', tier: 'important' },
  {
    name: 'Google-Extended',
    userAgent: 'Google-Extended',
    owner: 'Google',
    tier: 'important',
  },
  {
    name: 'OAI-SearchBot',
    userAgent: 'OAI-SearchBot',
    owner: 'OpenAI',
    tier: 'important',
  },
  { name: 'Bytespider', userAgent: 'Bytespider', owner: 'ByteDance', tier: 'important' },

  // Secondary — other AI-related crawlers
  { name: 'CCBot', userAgent: 'CCBot', owner: 'Common Crawl', tier: 'secondary' },
  { name: 'Amazonbot', userAgent: 'Amazonbot', owner: 'Amazon', tier: 'secondary' },
  { name: 'FacebookBot', userAgent: 'FacebookBot', owner: 'Meta', tier: 'secondary' },
  {
    name: 'Applebot-Extended',
    userAgent: 'Applebot-Extended',
    owner: 'Apple',
    tier: 'secondary',
  },
  { name: 'cohere-ai', userAgent: 'cohere-ai', owner: 'Cohere', tier: 'secondary' },
  { name: 'YouBot', userAgent: 'YouBot', owner: 'You.com', tier: 'secondary' },
  { name: 'Diffbot', userAgent: 'Diffbot', owner: 'Diffbot', tier: 'secondary' },
]

export const aiCrawlerAccess: AuditCheckDefinition = {
  name: 'ai_crawler_access',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Critical,
  description: 'Check if robots.txt blocks AI crawlers like GPTBot, ClaudeBot, PerplexityBot',
  displayName: 'AI Crawlers Blocked',
  displayNamePassed: 'AI Crawlers Allowed',
  learnMoreUrl: 'https://platform.openai.com/docs/gptbot',
  isSiteWide: true,
  fixGuidance:
    'Review your robots.txt to ensure critical AI crawlers (GPTBot, ClaudeBot, PerplexityBot) are not blocked. Remove or modify Disallow rules for these user agents.',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    let robotsTxt = context.robotsTxt

    // Fetch robots.txt if not provided in context
    if (robotsTxt === undefined) {
      try {
        const baseUrl = new URL(context.url).origin
        const response = await fetch(`${baseUrl}/robots.txt`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
        })
        if (!response.ok) {
          // No robots.txt = all bots allowed by default
          return buildResult(AI_BOTS.map((bot) => ({ ...bot, status: 'no-rule' as const })))
        }
        robotsTxt = await response.text()
      } catch {
        // Cannot access robots.txt — assume allowed
        return buildResult(AI_BOTS.map((bot) => ({ ...bot, status: 'no-rule' as const })))
      }
    }

    const botResults = AI_BOTS.map((bot) => ({
      ...bot,
      ...checkBotAccess(robotsTxt!, bot.userAgent),
    }))

    return buildResult(botResults)
  },
}

/**
 * Parse robots.txt to determine if a specific bot is blocked.
 *
 * Checks for bot-specific rules first, then falls back to wildcard rules.
 * A bot is "blocked" if it matches a Disallow: / rule (blocking root).
 * A bot is "allowed" if there is an explicit Allow rule or no blocking Disallow.
 * A bot has "no-rule" if there are no rules at all for it (or wildcard).
 */
function checkBotAccess(
  robotsTxt: string,
  userAgent: string
): { status: 'allowed' | 'blocked' | 'no-rule'; rule?: string } {
  const lines = robotsTxt.split('\n').map((l) => l.trim())

  // Parse into blocks: each block starts with one or more User-agent lines
  const blocks = parseRobotsTxtBlocks(lines)

  // Find the most specific matching block for this bot
  const specificBlock = blocks.find((block) =>
    block.userAgents.some((ua) => ua.toLowerCase() === userAgent.toLowerCase())
  )

  const wildcardBlock = blocks.find((block) => block.userAgents.some((ua) => ua === '*'))

  const block = specificBlock || wildcardBlock

  if (!block) {
    return { status: 'no-rule' }
  }

  // Check if root path is disallowed
  const hasRootDisallow = block.rules.some(
    (r) => r.type === 'disallow' && (r.path === '/' || r.path === '/*')
  )
  const hasRootAllow = block.rules.some(
    (r) => r.type === 'allow' && (r.path === '/' || r.path === '/*')
  )

  if (hasRootDisallow && !hasRootAllow) {
    const rule = specificBlock
      ? `User-agent: ${userAgent} / Disallow: /`
      : `User-agent: * / Disallow: /`
    return { status: 'blocked', rule }
  }

  if (specificBlock) {
    return { status: 'allowed', rule: `User-agent: ${userAgent} (no blocking rule)` }
  }

  return { status: 'no-rule' }
}

interface RobotsTxtBlock {
  userAgents: string[]
  rules: { type: 'allow' | 'disallow'; path: string }[]
}

function parseRobotsTxtBlocks(lines: string[]): RobotsTxtBlock[] {
  const blocks: RobotsTxtBlock[] = []
  let currentUserAgents: string[] = []
  let currentRules: { type: 'allow' | 'disallow'; path: string }[] = []
  let inBlock = false

  for (const line of lines) {
    // Skip comments and empty lines
    const cleanLine = line.split('#')[0].trim()
    if (!cleanLine) {
      if (inBlock && currentUserAgents.length > 0 && currentRules.length > 0) {
        blocks.push({ userAgents: currentUserAgents, rules: currentRules })
        currentUserAgents = []
        currentRules = []
        inBlock = false
      }
      continue
    }

    const uaMatch = cleanLine.match(/^User-agent:\s*(.+)$/i)
    if (uaMatch) {
      // If we were collecting rules, save the previous block
      if (currentRules.length > 0 && currentUserAgents.length > 0) {
        blocks.push({ userAgents: currentUserAgents, rules: currentRules })
        currentUserAgents = []
        currentRules = []
      }
      currentUserAgents.push(uaMatch[1].trim())
      inBlock = true
      continue
    }

    const disallowMatch = cleanLine.match(/^Disallow:\s*(.*)$/i)
    if (disallowMatch && inBlock) {
      const path = disallowMatch[1].trim()
      if (path) {
        currentRules.push({ type: 'disallow', path })
      }
      continue
    }

    const allowMatch = cleanLine.match(/^Allow:\s*(.*)$/i)
    if (allowMatch && inBlock) {
      const path = allowMatch[1].trim()
      if (path) {
        currentRules.push({ type: 'allow', path })
      }
      continue
    }
  }

  // Don't forget the last block
  if (currentUserAgents.length > 0 && currentRules.length > 0) {
    blocks.push({ userAgents: currentUserAgents, rules: currentRules })
  }

  return blocks
}

function buildResult(
  botResults: (BotDefinition & { status: 'allowed' | 'blocked' | 'no-rule'; rule?: string })[]
): CheckResult {
  const breakdown: AICrawlerBreakdown = {
    bots: botResults.map((b) => ({
      name: b.name,
      userAgent: b.userAgent,
      owner: b.owner,
      status: b.status,
      rule: b.rule,
    })),
    allowedCount: botResults.filter((b) => b.status === 'allowed' || b.status === 'no-rule').length,
    blockedCount: botResults.filter((b) => b.status === 'blocked').length,
    criticalBlocked: botResults
      .filter((b) => b.tier === 'critical' && b.status === 'blocked')
      .map((b) => b.name),
  }

  const anyCriticalBlocked = breakdown.criticalBlocked.length > 0
  const anyBlocked = breakdown.blockedCount > 0

  if (anyCriticalBlocked) {
    return {
      status: CheckStatus.Failed,
      details: {
        message: `Critical AI crawlers are blocked: ${breakdown.criticalBlocked.join(', ')}. This prevents major AI assistants from citing your content.`,
        breakdown,
      },
    }
  }

  if (anyBlocked) {
    const blockedNames = botResults.filter((b) => b.status === 'blocked').map((b) => b.name)
    return {
      status: CheckStatus.Warning,
      details: {
        message: `Some non-critical AI crawlers are blocked: ${blockedNames.join(', ')}. Critical bots (GPTBot, ClaudeBot, PerplexityBot) are allowed.`,
        breakdown,
      },
    }
  }

  return {
    status: CheckStatus.Passed,
    details: {
      message: 'All AI crawlers are allowed in robots.txt',
      breakdown,
    },
  }
}
