import { generateObject } from 'ai'
import { z } from 'zod'
import { getAnthropicProvider } from '@/lib/ai/provider'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { loadPromptOverrides, type PromptOverrides } from './overrides'
import {
  coverSubtitlePrompt,
  gaSummaryPrompt,
  initiativesPrompt,
  linkedinInsightsPrompt,
  planningPrompt,
  takeawaysPrompt,
  type PromptContext,
} from './prompts'

const MODEL_ID = 'claude-opus-4-7'

const NarrativeSchema = z.object({
  cover_subtitle: z.string().max(200),
  ga_summary: z.string(),
  linkedin_insights: z.string(),
  initiatives: z.string(),
  takeaways: z.string(),
  planning: z.string(),
})

export interface GenerateNarrativeInput {
  organizationId: string
  organizationName: string
  quarter: string
  periodStart: string
  periodEnd: string
  data: SnapshotData
  reviewId?: string
}

const EMPTY_NARRATIVE: Required<NarrativeBlocks> = {
  cover_subtitle: '',
  ga_summary: '',
  linkedin_insights: '',
  initiatives: '',
  takeaways: '',
  planning: '',
}

function buildMasterPrompt(ctx: PromptContext, overrides: PromptOverrides): string {
  return [
    'You are generating six narrative blocks for a quarterly marketing performance report.',
    'Return one string per block, following each block’s specific instructions below.',
    '',
    '=== Block: cover_subtitle ===',
    coverSubtitlePrompt(ctx, overrides.cover_subtitle),
    '',
    '=== Block: ga_summary ===',
    gaSummaryPrompt(ctx, overrides.ga_summary),
    '',
    '=== Block: linkedin_insights ===',
    linkedinInsightsPrompt(ctx, overrides.linkedin_insights),
    '',
    '=== Block: initiatives ===',
    initiativesPrompt(ctx, overrides.initiatives),
    '',
    '=== Block: takeaways ===',
    takeawaysPrompt(ctx, overrides.takeaways),
    '',
    '=== Block: planning ===',
    planningPrompt(ctx, overrides.planning),
  ].join('\n')
}

export async function generateNarrativeBlocks(
  input: GenerateNarrativeInput
): Promise<Required<NarrativeBlocks>> {
  const ctx: PromptContext = {
    organizationName: input.organizationName,
    quarter: input.quarter,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    data: input.data,
  }

  try {
    const overrides = await loadPromptOverrides(input.organizationId)
    const anthropic = await getAnthropicProvider()
    const { object, usage } = await generateObject({
      model: anthropic(MODEL_ID),
      schema: NarrativeSchema,
      prompt: buildMasterPrompt(ctx, overrides),
    })

    await logUsage('anthropic', 'review_narrative_generation', {
      organizationId: input.organizationId,
      feature: UsageFeature.MarketingReviews,
      tokensInput: usage?.inputTokens,
      tokensOutput: usage?.outputTokens,
      metadata: { reviewId: input.reviewId, quarter: input.quarter },
    })

    return object
  } catch (error) {
    console.error('[Review Narrative Generation Error]', {
      type: 'ai_generation_failed',
      organizationId: input.organizationId,
      quarter: input.quarter,
      reviewId: input.reviewId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return { ...EMPTY_NARRATIVE }
  }
}
