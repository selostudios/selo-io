import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrandSentiment } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mocked-model'),
}))

import { analyzeSentiment, analyzeSentimentBatch } from '@/lib/ai-visibility/sentiment'
import { generateText } from 'ai'

describe('analyzeSentiment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies a positive mention', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'positive',
      usage: { inputTokens: 50, outputTokens: 5, totalTokens: 55 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await analyzeSentiment(
      'Warby Parker offers excellent quality frames at unbeatable prices.',
      'Warby Parker'
    )
    expect(result.sentiment).toBe(BrandSentiment.Positive)
  })

  it('defaults to neutral on API failure', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('API error'))

    const result = await analyzeSentiment('Some text', 'Brand')
    expect(result.sentiment).toBe(BrandSentiment.Neutral)
    expect(result.costCents).toBe(0)
  })

  it('defaults to neutral on unexpected response', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'maybe slightly positive but also somewhat mixed',
      usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await analyzeSentiment('Some text', 'Brand')
    expect(result.sentiment).toBe(BrandSentiment.Neutral)
  })

  it('tracks token cost', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'negative',
      usage: { inputTokens: 100, outputTokens: 5, totalTokens: 105 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await analyzeSentiment('Terrible brand', 'Brand')
    expect(result.sentiment).toBe(BrandSentiment.Negative)
    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(5)
  })
})

describe('analyzeSentimentBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies multiple responses in one API call', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { index: 0, sentiment: 'positive' },
        { index: 1, sentiment: 'negative' },
        { index: 2, sentiment: 'neutral' },
      ]),
      usage: { inputTokens: 200, outputTokens: 50, totalTokens: 250 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const items = [
      { text: 'Great brand!', brandName: 'Brand' },
      { text: 'Terrible service.', brandName: 'Brand' },
      { text: 'Brand exists.', brandName: 'Brand' },
    ]

    const result = await analyzeSentimentBatch(items)
    expect(result.sentiments).toEqual([
      BrandSentiment.Positive,
      BrandSentiment.Negative,
      BrandSentiment.Neutral,
    ])
  })

  it('returns neutral for all items on API failure', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('API error'))

    const items = [
      { text: 'Text 1', brandName: 'Brand' },
      { text: 'Text 2', brandName: 'Brand' },
    ]

    const result = await analyzeSentimentBatch(items)
    expect(result.sentiments).toEqual([BrandSentiment.Neutral, BrandSentiment.Neutral])
    expect(result.costCents).toBe(0)
  })
})
