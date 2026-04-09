import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'

const MODEL = 'claude-sonnet-4-20250514'

export class ClaudeAdapter implements AIProviderAdapter {
  platform = AIPlatform.Claude

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const { text, usage } = await generateText({
        model: anthropic(MODEL),
        prompt,
      })

      const inputTokens = usage?.inputTokens ?? 0
      const outputTokens = usage?.outputTokens ?? 0

      return {
        text,
        citations: [],
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents: estimateCostCents(AIPlatform.Claude, inputTokens, outputTokens),
      }
    } catch (error) {
      throw new Error(
        `Claude query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
