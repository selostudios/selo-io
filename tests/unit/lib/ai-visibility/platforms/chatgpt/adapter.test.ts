import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mocked-model'),
}))

import { ChatGPTAdapter } from '@/lib/ai-visibility/platforms/chatgpt/adapter'
import { generateText } from 'ai'

describe('ChatGPTAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has platform set to ChatGPT', () => {
    const adapter = new ChatGPTAdapter()
    expect(adapter.platform).toBe(AIPlatform.ChatGPT)
  })

  it('returns a standardized response from OpenAI', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Warby Parker is known for affordable eyewear. Visit https://warbyparker.com for more.',
      usage: { inputTokens: 50, outputTokens: 100 },
    } as any)

    const adapter = new ChatGPTAdapter()
    const result = await adapter.query('Tell me about Warby Parker')

    expect(result.text).toContain('Warby Parker')
    expect(result.model).toBe('gpt-4o-mini')
    expect(result.inputTokens).toBe(50)
    expect(result.outputTokens).toBe(100)
    expect(result.costCents).toBeGreaterThanOrEqual(0)
    expect(result.citations).toEqual([])
  })

  it('passes the prompt to generateText', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      usage: { inputTokens: 10, outputTokens: 20 },
    } as any)

    const adapter = new ChatGPTAdapter()
    await adapter.query('What is the best eyewear brand?')

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'What is the best eyewear brand?',
      })
    )
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Rate limit exceeded'))

    const adapter = new ChatGPTAdapter()
    await expect(adapter.query('test')).rejects.toThrow('ChatGPT query failed: Rate limit exceeded')
  })
})
