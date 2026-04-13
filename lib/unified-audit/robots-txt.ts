const SELO_USER_AGENT = 'SeloIOBot'
const FETCH_TIMEOUT_MS = 5000

interface RobotsTxtRule {
  type: 'allow' | 'disallow'
  path: string
}

interface RobotsTxtBlock {
  userAgents: string[]
  rules: RobotsTxtRule[]
  crawlDelay: number | null
}

/**
 * Pre-resolved rules for our bot, ready to store as JSON in the DB.
 * No re-parsing needed when loaded across batch continuations.
 */
export interface ResolvedRobotsTxtRules {
  rules: RobotsTxtRule[]
  crawlDelayMs: number | null
}

/**
 * Fetch robots.txt from a site's root.
 * Returns the raw text content, or null if not found / unreachable.
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  const origin = new URL(baseUrl).origin
  const robotsUrl = `${origin}/robots.txt`

  try {
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': `${SELO_USER_AGENT}/1.0 (Site Audit; +https://selo.io/bot)` },
    })

    if (!response.ok) return null

    const text = await response.text()

    // Sanity check: if it looks like HTML, it's a soft 404
    if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
      return null
    }

    return text
  } catch {
    return null
  }
}

/**
 * Parse raw robots.txt content into blocks.
 */
function parseRobotsTxtBlocks(content: string): RobotsTxtBlock[] {
  const lines = content.split('\n')
  const blocks: RobotsTxtBlock[] = []
  let currentUserAgents: string[] = []
  let currentRules: RobotsTxtRule[] = []
  let currentCrawlDelay: number | null = null
  let inBlock = false

  for (const line of lines) {
    const cleanLine = line.split('#')[0].trim()
    if (!cleanLine) {
      if (inBlock && currentUserAgents.length > 0) {
        blocks.push({
          userAgents: currentUserAgents,
          rules: currentRules,
          crawlDelay: currentCrawlDelay,
        })
        currentUserAgents = []
        currentRules = []
        currentCrawlDelay = null
        inBlock = false
      }
      continue
    }

    const uaMatch = cleanLine.match(/^User-agent:\s*(.+)$/i)
    if (uaMatch) {
      if (currentRules.length > 0 && currentUserAgents.length > 0) {
        blocks.push({
          userAgents: currentUserAgents,
          rules: currentRules,
          crawlDelay: currentCrawlDelay,
        })
        currentUserAgents = []
        currentRules = []
        currentCrawlDelay = null
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

    const crawlDelayMatch = cleanLine.match(/^Crawl-delay:\s*(\d+\.?\d*)$/i)
    if (crawlDelayMatch && inBlock) {
      currentCrawlDelay = parseFloat(crawlDelayMatch[1])
      continue
    }
  }

  // Don't forget the last block
  if (currentUserAgents.length > 0) {
    blocks.push({
      userAgents: currentUserAgents,
      rules: currentRules,
      crawlDelay: currentCrawlDelay,
    })
  }

  return blocks
}

/**
 * Resolve robots.txt content into pre-computed rules for our bot.
 * Finds the SeloIOBot-specific block, or falls back to wildcard.
 * Returns null if no relevant rules found.
 */
export function resolveRobotsTxtRules(content: string): ResolvedRobotsTxtRules | null {
  const blocks = parseRobotsTxtBlocks(content)
  const uaLower = SELO_USER_AGENT.toLowerCase()

  // Look for a bot-specific block first, then wildcard
  const block =
    blocks.find((b) => b.userAgents.some((ua) => ua.toLowerCase() === uaLower)) ??
    blocks.find((b) => b.userAgents.includes('*')) ??
    null

  if (!block) return null

  return {
    rules: block.rules,
    crawlDelayMs: block.crawlDelay ? block.crawlDelay * 1000 : null,
  }
}

/**
 * Check if a given URL path is allowed by pre-resolved robots.txt rules.
 * Uses standard robots.txt precedence: most specific path match wins.
 * If equal length, Allow wins over Disallow.
 * Returns true if no rules apply (permissive by default).
 */
export function isPathAllowed(resolved: ResolvedRobotsTxtRules, path: string): boolean {
  if (resolved.rules.length === 0) return true

  // Empty Disallow means allow all
  if (
    resolved.rules.length === 1 &&
    resolved.rules[0].type === 'disallow' &&
    !resolved.rules[0].path
  ) {
    return true
  }

  // Find the most specific matching rule
  let bestMatch: RobotsTxtRule | null = null
  let bestLength = -1

  for (const rule of resolved.rules) {
    // Handle wildcard patterns (e.g., /foo/*)
    const cleanPath = rule.path.replace(/\*$/, '')

    if (path.startsWith(cleanPath)) {
      if (cleanPath.length > bestLength) {
        bestMatch = rule
        bestLength = cleanPath.length
      } else if (cleanPath.length === bestLength && rule.type === 'allow') {
        // Equal length: Allow wins
        bestMatch = rule
      }
    }
  }

  if (!bestMatch) return true
  return bestMatch.type === 'allow'
}
