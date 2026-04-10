import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@/lib/ai/provider', () => ({
  getAnthropicProvider: vi.fn().mockResolvedValue(vi.fn().mockReturnValue('mocked-model')),
}))

import { ClaudeAdapter } from '@/lib/ai-visibility/platforms/claude/adapter'
import { generateText } from 'ai'

describe('ClaudeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has platform set to Claude', () => {
    const adapter = new ClaudeAdapter()
    expect(adapter.platform).toBe(AIPlatform.Claude)
  })

  it('returns a standardized response from Anthropic', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Warby Parker offers prescription glasses online.',
      usage: { inputTokens: 40, outputTokens: 80 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const adapter = new ClaudeAdapter()
    const result = await adapter.query('Tell me about Warby Parker')

    expect(result.text).toContain('Warby Parker')
    expect(result.model).toBe('claude-sonnet-4-20250514')
    expect(result.inputTokens).toBe(40)
    expect(result.outputTokens).toBe(80)
    expect(result.costCents).toBeGreaterThanOrEqual(0)
    expect(result.citations).toEqual([])
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Overloaded'))

    const adapter = new ClaudeAdapter()
    await expect(adapter.query('test')).rejects.toThrow('Claude query failed: Overloaded')
  })
})
