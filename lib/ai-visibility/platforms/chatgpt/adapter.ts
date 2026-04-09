import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'

const MODEL = 'gpt-4o-mini'

export class ChatGPTAdapter implements AIProviderAdapter {
  platform = AIPlatform.ChatGPT

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const { text, usage } = await generateText({
        model: openai(MODEL),
        prompt,
      })

      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0

      return {
        text,
        citations: [],
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents: estimateCostCents(AIPlatform.ChatGPT, inputTokens, outputTokens),
      }
    } catch (error) {
      throw new Error(
        `ChatGPT query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
