import { AIPlatform } from '@/lib/enums'

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Every AI platform adapter must implement this interface.
 * The sync pipeline calls `query()` and processes the standardized response.
 */
export interface AIProviderAdapter {
  platform: AIPlatform
  query(prompt: string): Promise<AIProviderResponse>
}

/**
 * Standardized response from any AI platform.
 * Adapters normalize platform-specific responses into this shape.
 */
export interface AIProviderResponse {
  text: string
  citations: string[]
  model: string
  inputTokens: number
  outputTokens: number
  costCents: number
}

// =============================================================================
// Cost Calculation
// =============================================================================

interface PlatformCost {
  inputPerMillionTokens: number // USD
  outputPerMillionTokens: number // USD
}

export const PLATFORM_COSTS: Record<AIPlatform, PlatformCost> = {
  [AIPlatform.ChatGPT]: {
    inputPerMillionTokens: 2.5, // GPT-4o mini
    outputPerMillionTokens: 10,
  },
  [AIPlatform.Claude]: {
    inputPerMillionTokens: 3, // Claude Sonnet
    outputPerMillionTokens: 15,
  },
  [AIPlatform.Perplexity]: {
    inputPerMillionTokens: 1, // Sonar
    outputPerMillionTokens: 1,
  },
}

/**
 * Estimate cost in cents from token counts for a given platform.
 */
export function estimateCostCents(
  platform: AIPlatform,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = PLATFORM_COSTS[platform]
  const dollars =
    (inputTokens / 1_000_000) * costs.inputPerMillionTokens +
    (outputTokens / 1_000_000) * costs.outputPerMillionTokens
  return Math.round(dollars * 100)
}
