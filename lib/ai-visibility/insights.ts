import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { BrandSentiment } from '@/lib/enums'
import type { AnalyzedResponse, OrgContext } from './analyzer'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Build the prompt for Claude Haiku to generate an actionable insight.
 * Exported for testing — the actual API call is in generateInsight().
 */
export function buildInsightPrompt(
  responseText: string,
  analysis: AnalyzedResponse,
  context: OrgContext
): string {
  const { brandName, domain, competitors, competitorDomains } = context

  const competitorInfo = competitors?.length
    ? `Competitors: ${competitors.map((c) => `${c} (${competitorDomains?.[c] ?? 'unknown domain'})`).join(', ')}.`
    : ''

  const citedInfo = analysis.cited_urls.length
    ? `URLs cited in the response: ${analysis.cited_urls.join(', ')}.`
    : 'No URLs were cited in the response.'

  const competitorMentionInfo = analysis.competitor_mentions?.length
    ? `Competitor mentions: ${analysis.competitor_mentions.map((c) => `${c.name}: ${c.mentioned ? 'mentioned' : 'not mentioned'}, ${c.cited ? 'cited' : 'not cited'}`).join('; ')}.`
    : ''

  let situationContext: string
  let focus: string

  if (!analysis.brand_mentioned) {
    situationContext = `The brand "${brandName}" (${domain}) was not mentioned in this AI response.`
    focus =
      'Explain why the brand was likely not mentioned and provide 2-3 specific, actionable steps to get mentioned in responses to this type of query.'
  } else if (analysis.brand_sentiment === BrandSentiment.Negative) {
    situationContext = `The brand "${brandName}" was mentioned but with negative sentiment.`
    focus =
      'Identify what in the response drives the negative sentiment toward the brand and suggest 2-3 specific actions to improve how AI platforms perceive the brand.'
  } else if (analysis.brand_position !== null && analysis.brand_position >= 2) {
    situationContext = `The brand "${brandName}" was mentioned at position ${analysis.brand_position} (not first).`
    focus =
      'Explain why the brand appears lower and suggest 2-3 specific actions to move up in AI response rankings for this type of query.'
  } else if (!analysis.domain_cited) {
    situationContext = `The brand "${brandName}" was mentioned but its website (${domain}) was not cited as a source.`
    focus =
      'Explain why the brand is mentioned but not cited and suggest 2-3 specific actions to become a cited source in AI responses.'
  } else {
    situationContext = `The brand "${brandName}" was mentioned positively at position ${analysis.brand_position ?? 'N/A'} and its website is cited.`
    focus =
      'Briefly explain what is working well for this brand in AI visibility and suggest 1-2 ways to maintain or strengthen this position.'
  }

  return `You are an AI visibility consultant. Analyze this AI platform response and provide actionable insights.

Brand: ${brandName}
Website: ${domain}
${competitorInfo}

${situationContext}

AI platform response:
"""
${responseText.slice(0, 2000)}
"""

${citedInfo}
${competitorMentionInfo}

${focus}

Be specific and actionable. Reference the actual response content, competitors mentioned, and URLs cited. Keep your response under 150 words. Use bullet points.`
}

/**
 * Generate an AI-powered insight for a research result.
 * Returns null on failure (never throws).
 */
export async function generateInsight(
  responseText: string,
  analysis: AnalyzedResponse,
  context: OrgContext
): Promise<{ insight: string; costCents: number } | null> {
  try {
    const prompt = buildInsightPrompt(responseText, analysis, context)

    const result = await generateText({
      model: anthropic(HAIKU_MODEL),
      prompt,
      maxOutputTokens: 300,
    })

    // Haiku pricing: $1 input / $5 output per million tokens
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const costCents = Math.round((inputTokens * 1) / 10000 + (outputTokens * 5) / 10000)

    return {
      insight: result.text,
      costCents,
    }
  } catch (error) {
    console.error('[AI Visibility Insight Error]', {
      type: 'insight_generation_failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return null
  }
}
