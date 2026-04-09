import { BrandSentiment } from '@/lib/enums'

interface ScoreInput {
  totalPrompts: number
  mentionedCount: number
  citedCount: number
  sentiments: BrandSentiment[]
}

const SENTIMENT_SCORES: Record<BrandSentiment, number> = {
  [BrandSentiment.Positive]: 100,
  [BrandSentiment.Neutral]: 50,
  [BrandSentiment.Negative]: 0,
}

/**
 * Calculate AI Visibility Score (0-100).
 *
 * Weighted composite:
 *   mentionRate * 40% + citationRate * 40% + sentimentScore * 20%
 */
export function calculateVisibilityScore(input: ScoreInput): number {
  const { totalPrompts, mentionedCount, citedCount, sentiments } = input

  if (totalPrompts === 0) return 0

  const mentionRate = (mentionedCount / totalPrompts) * 100
  const citationRate = (citedCount / totalPrompts) * 100

  let sentimentScore = 0
  if (sentiments.length > 0) {
    const total = sentiments.reduce((sum, s) => sum + SENTIMENT_SCORES[s], 0)
    sentimentScore = total / sentiments.length
  }

  const score = mentionRate * 0.4 + citationRate * 0.4 + sentimentScore * 0.2

  return Math.round(Math.min(100, Math.max(0, score)))
}
