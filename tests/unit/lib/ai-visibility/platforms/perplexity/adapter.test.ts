import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/perplexity', () => ({
  perplexity: vi.fn().mockReturnValue('mocked-model'),
}))

import { PerplexityAdapter } from '@/lib/ai-visibility/platforms/perplexity/adapter'
import { generateText } from 'ai'

describe('PerplexityAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has platform set to Perplexity', () => {
    const adapter = new PerplexityAdapter()
    expect(adapter.platform).toBe(AIPlatform.Perplexity)
  })

  it('returns a standardized response with native citations', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Warby Parker is a popular eyewear retailer [1].',
      sources: [
        { url: 'https://warbyparker.com', title: 'Warby Parker' },
        { url: 'https://example.com/review', title: 'Review' },
      ],
      usage: { inputTokens: 30, outputTokens: 60, totalTokens: 90 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const adapter = new PerplexityAdapter()
    const result = await adapter.query('Tell me about Warby Parker')

    expect(result.text).toContain('Warby Parker')
    expect(result.model).toBe('sonar')
    expect(result.citations).toEqual(['https://warbyparker.com', 'https://example.com/review'])
    expect(result.inputTokens).toBe(30)
    expect(result.outputTokens).toBe(60)
  })

  it('handles missing sources gracefully', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Some response without citations.',
      sources: undefined,
      usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const adapter = new PerplexityAdapter()
    const result = await adapter.query('test')

    expect(result.citations).toEqual([])
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Service unavailable'))

    const adapter = new PerplexityAdapter()
    await expect(adapter.query('test')).rejects.toThrow(
      'Perplexity query failed: Service unavailable'
    )
  })
})
