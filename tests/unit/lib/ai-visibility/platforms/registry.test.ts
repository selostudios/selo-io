import { describe, it, expect } from 'vitest'
import { AIPlatform } from '@/lib/enums'
import { getAdapter, getAdapters } from '@/lib/ai-visibility/platforms/registry'

describe('Adapter registry', () => {
  it('returns ChatGPT adapter for ChatGPT platform', () => {
    const adapter = getAdapter(AIPlatform.ChatGPT)
    expect(adapter.platform).toBe(AIPlatform.ChatGPT)
  })

  it('returns Claude adapter for Claude platform', () => {
    const adapter = getAdapter(AIPlatform.Claude)
    expect(adapter.platform).toBe(AIPlatform.Claude)
  })

  it('returns Perplexity adapter for Perplexity platform', () => {
    const adapter = getAdapter(AIPlatform.Perplexity)
    expect(adapter.platform).toBe(AIPlatform.Perplexity)
  })

  it('returns multiple adapters for a list of platforms', () => {
    const adapters = getAdapters([AIPlatform.ChatGPT, AIPlatform.Perplexity])
    expect(adapters).toHaveLength(2)
    expect(adapters[0].platform).toBe(AIPlatform.ChatGPT)
    expect(adapters[1].platform).toBe(AIPlatform.Perplexity)
  })

  it('throws for unknown platform', () => {
    expect(() => getAdapter('unknown' as AIPlatform)).toThrow('No adapter for platform: unknown')
  })
})
