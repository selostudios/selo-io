import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { generateObject } from 'ai'
import { generateNarrativeBlocks } from '@/lib/reviews/narrative/generator'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/provider', () => ({
  getAnthropicProvider: vi.fn(async () => () => 'mock-model'),
}))

vi.mock('@/lib/app-settings/usage', () => ({
  logUsage: vi.fn(async () => {}),
}))

const baseInput = {
  organizationId: 'org-1',
  organizationName: 'Acme',
  quarter: '2026-Q1',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  data: {},
  reviewId: 'review-1',
}

describe('generateNarrativeBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns all six blocks produced by the model', async () => {
    const object = {
      cover_subtitle: 'Strong quarter for organic growth.',
      ga_summary: 'GA narrative.',
      linkedin_insights: 'LinkedIn narrative.',
      initiatives: 'Initiatives narrative.',
      takeaways: 'Takeaways narrative.',
      planning: 'Planning narrative.',
    }
    ;(generateObject as unknown as Mock).mockResolvedValue({
      object,
      usage: { inputTokens: 100, outputTokens: 200 },
    })

    const result = await generateNarrativeBlocks(baseInput)
    expect(result).toEqual(object)
  })

  test('logs usage with MarketingReviews feature and token counts on success', async () => {
    ;(generateObject as unknown as Mock).mockResolvedValue({
      object: {
        cover_subtitle: 'x',
        ga_summary: 'x',
        linkedin_insights: 'x',
        initiatives: 'x',
        takeaways: 'x',
        planning: 'x',
      },
      usage: { inputTokens: 1234, outputTokens: 567 },
    })

    await generateNarrativeBlocks(baseInput)

    expect(logUsage).toHaveBeenCalledWith(
      'anthropic',
      'review_narrative_generation',
      expect.objectContaining({
        organizationId: 'org-1',
        feature: UsageFeature.MarketingReviews,
        tokensInput: 1234,
        tokensOutput: 567,
        metadata: { reviewId: 'review-1', quarter: '2026-Q1' },
      })
    )
  })

  test('falls back to empty strings for all six blocks when the model call throws', async () => {
    ;(generateObject as unknown as Mock).mockRejectedValue(new Error('anthropic unavailable'))

    const result = await generateNarrativeBlocks(baseInput)
    expect(result).toEqual({
      cover_subtitle: '',
      ga_summary: '',
      linkedin_insights: '',
      initiatives: '',
      takeaways: '',
      planning: '',
    })
  })

  test('does not log usage when the model call fails', async () => {
    ;(generateObject as unknown as Mock).mockRejectedValue(new Error('boom'))

    await generateNarrativeBlocks(baseInput)
    expect(logUsage).not.toHaveBeenCalled()
  })
})
