import { generateText } from 'ai'
import { getOpenAIProvider } from '@/lib/ai/provider'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'
import { AI_MODELS } from '../models'

export class ChatGPTAdapter implements AIProviderAdapter {
  platform = AIPlatform.ChatGPT

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const openai = await getOpenAIProvider()
      const { text, usage } = await generateText({
        model: openai(AI_MODELS.chatgpt),
        prompt,
      })

      const inputTokens = usage?.inputTokens ?? 0
      const outputTokens = usage?.outputTokens ?? 0

      return {
        text,
        citations: [],
        model: AI_MODELS.chatgpt,
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
