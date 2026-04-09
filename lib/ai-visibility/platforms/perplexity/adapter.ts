import { generateText } from 'ai'
import { perplexity } from '@ai-sdk/perplexity'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'

const MODEL = 'sonar'

interface PerplexitySource {
  url: string
  title?: string
}

export class PerplexityAdapter implements AIProviderAdapter {
  platform = AIPlatform.Perplexity

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const result = await generateText({
        model: perplexity(MODEL),
        prompt,
        providerOptions: {
          perplexity: {
            search_recency_filter: 'month',
          },
        },
      })

      const inputTokens = result.usage?.inputTokens ?? 0
      const outputTokens = result.usage?.outputTokens ?? 0

      // Extract citation URLs from Perplexity's native sources
      const sources = (result as unknown as { sources?: PerplexitySource[] }).sources
      const citations = (sources ?? []).map((s) => s.url).filter(Boolean)

      return {
        text: result.text,
        citations,
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents: estimateCostCents(AIPlatform.Perplexity, inputTokens, outputTokens),
      }
    } catch (error) {
      throw new Error(
        `Perplexity query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
