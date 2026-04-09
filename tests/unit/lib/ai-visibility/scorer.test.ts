import { describe, it, expect } from 'vitest'
import { BrandSentiment } from '@/lib/enums'
import { calculateVisibilityScore } from '@/lib/ai-visibility/scorer'

describe('calculateVisibilityScore', () => {
  it('returns 100 when all prompts are mentioned, cited, and positive', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 10,
      mentionedCount: 10,
      citedCount: 10,
      sentiments: Array(10).fill(BrandSentiment.Positive),
    })
    expect(score).toBe(100)
  })

  it('returns 0 when no mentions, no citations, no positive sentiment', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 10,
      mentionedCount: 0,
      citedCount: 0,
      sentiments: [],
    })
    expect(score).toBe(0)
  })

  it('returns 0 for zero prompts', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 0,
      mentionedCount: 0,
      citedCount: 0,
      sentiments: [],
    })
    expect(score).toBe(0)
  })

  it('weights mentions at 40%, citations at 40%, sentiment at 20%', () => {
    // 50% mention rate (40% weight) = 20
    // 50% citation rate (40% weight) = 20
    // all neutral sentiment (50 pts, 20% weight) = 10
    const score = calculateVisibilityScore({
      totalPrompts: 10,
      mentionedCount: 5,
      citedCount: 5,
      sentiments: Array(5).fill(BrandSentiment.Neutral),
    })
    expect(score).toBe(50)
  })

  it('handles mixed sentiments correctly', () => {
    // 100% mention = 40
    // 0% citation = 0
    // 3 positive (100) + 2 negative (0) = avg 60, * 0.2 = 12
    const score = calculateVisibilityScore({
      totalPrompts: 5,
      mentionedCount: 5,
      citedCount: 0,
      sentiments: [
        BrandSentiment.Positive,
        BrandSentiment.Positive,
        BrandSentiment.Positive,
        BrandSentiment.Negative,
        BrandSentiment.Negative,
      ],
    })
    expect(score).toBe(52)
  })

  it('clamps score between 0 and 100', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 1,
      mentionedCount: 1,
      citedCount: 1,
      sentiments: [BrandSentiment.Positive],
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
