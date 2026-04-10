import { describe, it, expect } from 'vitest'
import {
  type AIProviderResponse,
  PLATFORM_COSTS,
  estimateCostCents,
} from '@/lib/ai-visibility/platforms/types'
import { AIPlatform } from '@/lib/enums'

describe('AI Provider platform types', () => {
  it('PLATFORM_COSTS contains cost info for all platforms', () => {
    expect(PLATFORM_COSTS[AIPlatform.ChatGPT]).toBeDefined()
    expect(PLATFORM_COSTS[AIPlatform.Claude]).toBeDefined()
    expect(PLATFORM_COSTS[AIPlatform.Perplexity]).toBeDefined()
    expect(PLATFORM_COSTS[AIPlatform.ChatGPT].inputPerMillionTokens).toBeGreaterThan(0)
  })

  it('estimateCostCents calculates cost from token counts', () => {
    const cost = estimateCostCents(AIPlatform.ChatGPT, 1000, 500)
    expect(cost).toBeGreaterThan(0)
    expect(typeof cost).toBe('number')
  })

  it('estimateCostCents returns 0 for zero tokens', () => {
    expect(estimateCostCents(AIPlatform.ChatGPT, 0, 0)).toBe(0)
  })

  it('type-checks AIProviderResponse', () => {
    const response: AIProviderResponse = {
      text: 'Warby Parker is a great eyewear brand...',
      citations: ['https://warbyparker.com'],
      model: 'gpt-4o-mini',
      inputTokens: 100,
      outputTokens: 200,
      costCents: 1,
    }
    expect(response.text).toContain('Warby Parker')
  })
})
