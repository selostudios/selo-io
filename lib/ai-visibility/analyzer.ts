import type { CompetitorMention } from './types'
import { BrandSentiment } from '@/lib/enums'
import type { AIProviderResponse } from './platforms/types'
import { analyzeSentiment } from './sentiment'

export interface BrandMentionResult {
  mentioned: boolean
  mentionCount: number
  position: number | null // 1=first third, 2=middle, 3=last third
}

/**
 * Detect brand mentions in an AI response.
 * Case-insensitive, supports aliases.
 */
export function detectBrandMention(
  text: string,
  brandName: string,
  aliases: string[] = []
): BrandMentionResult {
  if (!text) {
    return { mentioned: false, mentionCount: 0, position: null }
  }

  const lowerText = text.toLowerCase()
  const searchTerms = [brandName, ...aliases]

  let totalCount = 0
  let firstIndex = -1

  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase()
    let startPos = 0
    while (true) {
      const idx = lowerText.indexOf(lowerTerm, startPos)
      if (idx === -1) break
      totalCount++
      if (firstIndex === -1 || idx < firstIndex) {
        firstIndex = idx
      }
      startPos = idx + lowerTerm.length
    }
  }

  if (totalCount === 0) {
    return { mentioned: false, mentionCount: 0, position: null }
  }

  // Calculate position: which third of the text the first mention appears in
  const relativePosition = firstIndex / text.length
  const position = relativePosition < 0.33 ? 1 : relativePosition < 0.66 ? 2 : 3

  return { mentioned: true, mentionCount: totalCount, position }
}

export interface CitationResult {
  domainCited: boolean
  citedUrls: string[]
}

/**
 * Extract citations matching the org's domain.
 * First checks native citation URLs (from Perplexity), then falls back to
 * parsing URLs from the response text (for ChatGPT/Claude).
 */
export function extractCitations(
  nativeCitations: string[],
  domain: string,
  responseText?: string
): CitationResult {
  const domainLower = domain.toLowerCase()

  const matchesDomain = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname === domainLower || hostname === `www.${domainLower}`
    } catch {
      return false
    }
  }

  // Check native citations first
  let matchingUrls = nativeCitations.filter(matchesDomain)

  // Fall back to parsing URLs from text if no native citations provided
  if (matchingUrls.length === 0 && responseText) {
    const urlRegex = /https?:\/\/[^\s)>\]"']+/g
    const textUrls = responseText.match(urlRegex) ?? []
    matchingUrls = textUrls.filter(matchesDomain)
  }

  // Deduplicate
  const unique = [...new Set(matchingUrls)]

  return {
    domainCited: unique.length > 0,
    citedUrls: unique,
  }
}

/**
 * Detect competitor mentions and citations in an AI response.
 */
export function detectCompetitors(
  text: string,
  competitorNames: string[],
  allCitations: string[],
  competitorDomains?: Record<string, string>
): CompetitorMention[] {
  if (competitorNames.length === 0) return []

  const lowerText = text.toLowerCase()

  return competitorNames.map((name) => {
    const mentioned = lowerText.includes(name.toLowerCase())

    let cited = false
    if (competitorDomains?.[name]) {
      const domain = competitorDomains[name].toLowerCase()
      cited = allCitations.some((url) => {
        try {
          const hostname = new URL(url).hostname.toLowerCase()
          return hostname === domain || hostname === `www.${domain}`
        } catch {
          return false
        }
      })
    } else {
      // Heuristic: check if any citation URL contains the competitor name
      const nameParts = name.toLowerCase().split(/\s+/)
      const primaryPart = nameParts[0]
      cited = allCitations.some((url) => url.toLowerCase().includes(primaryPart))
    }

    return { name, mentioned, cited }
  })
}

export interface OrgContext {
  brandName: string
  domain: string
  aliases?: string[]
  competitors?: string[]
  competitorDomains?: Record<string, string>
}

export interface AnalyzedResponse {
  brand_mentioned: boolean
  brand_sentiment: string
  brand_position: number | null
  domain_cited: boolean
  cited_urls: string[]
  competitor_mentions: CompetitorMention[] | null
  sentiment_cost_cents: number
}

/**
 * Run all analysis steps on an AI provider response.
 */
export async function analyzeResponse(
  response: AIProviderResponse,
  context: OrgContext
): Promise<AnalyzedResponse> {
  const mention = detectBrandMention(response.text, context.brandName, context.aliases)
  const citation = extractCitations(response.citations, context.domain, response.text)
  const competitors = detectCompetitors(
    response.text,
    context.competitors ?? [],
    response.citations,
    context.competitorDomains
  )

  // Only analyze sentiment if brand was mentioned
  let sentiment: BrandSentiment = BrandSentiment.Neutral
  let sentimentCostCents = 0
  if (mention.mentioned) {
    const sentimentResult = await analyzeSentiment(response.text, context.brandName)
    sentiment = sentimentResult.sentiment
    sentimentCostCents = sentimentResult.costCents
  }

  return {
    brand_mentioned: mention.mentioned,
    brand_sentiment: sentiment,
    brand_position: mention.position,
    domain_cited: citation.domainCited,
    cited_urls: citation.citedUrls,
    competitor_mentions: competitors.length > 0 ? competitors : null,
    sentiment_cost_cents: sentimentCostCents,
  }
}
