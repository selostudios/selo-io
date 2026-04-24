import { generateObject } from 'ai'
import { z } from 'zod'
import { getAnthropicProvider } from '@/lib/ai/provider'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { loadPromptOverrides, type PromptOverrides } from './overrides'
import {
  contentHighlightsPrompt,
  coverSubtitlePrompt,
  gaSummaryPrompt,
  initiativesPrompt,
  linkedinInsightsPrompt,
  planningPrompt,
  takeawaysPrompt,
  type PromptContext,
} from './prompts'
import { loadStyleMemo } from './style-memo'

const MODEL_ID = 'claude-opus-4-5'

const NarrativeSchema = z.object({
  cover_subtitle: z.string().max(200),
  ga_summary: z.string(),
  linkedin_insights: z.string(),
  content_highlights: z.string(),
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
  authorNotes?: string | null
}

export class NarrativeGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NarrativeGenerationError'
  }
}

function buildMasterPrompt(ctx: PromptContext, overrides: PromptOverrides): string {
  return [
    'You are generating seven narrative blocks for a quarterly marketing performance report.',
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
    '=== Block: content_highlights ===',
    contentHighlightsPrompt(ctx, overrides.content_highlights),
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
  try {
    const [overrides, styleMemo] = await Promise.all([
      loadPromptOverrides(input.organizationId),
      loadStyleMemo(input.organizationId),
    ])

    const ctx: PromptContext = {
      organizationName: input.organizationName,
      quarter: input.quarter,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      data: input.data,
      authorNotes: input.authorNotes ?? undefined,
      styleMemo: styleMemo.length > 0 ? styleMemo : undefined,
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Review Narrative Generation Error]', {
      type: 'ai_generation_failed',
      organizationId: input.organizationId,
      quarter: input.quarter,
      reviewId: input.reviewId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
    await logUsage('anthropic', 'review_narrative_generation', {
      organizationId: input.organizationId,
      feature: UsageFeature.MarketingReviews,
      metadata: {
        reviewId: input.reviewId,
        quarter: input.quarter,
        error: errorMessage,
        status: 'failed',
      },
    }).catch(() => {})
    throw new NarrativeGenerationError(errorMessage)
  }
}
