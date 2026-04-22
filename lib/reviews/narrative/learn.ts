import { generateText } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { getAnthropicProvider } from '@/lib/ai/provider'
import { buildLearnerDiff, loadStyleMemo, truncateMemo } from './style-memo'
import { buildLearnerPrompt } from './learner-prompts'
import type { NarrativeBlocks } from '@/lib/reviews/types'

const LEARNER_MODEL_ID = 'claude-opus-4-7'

export interface RunStyleMemoLearnerInput {
  organizationId: string
  organizationName: string
  ai: NarrativeBlocks
  finalNarrative: NarrativeBlocks
  authorNotes: string | null
}

export type RunStyleMemoLearnerResult =
  | { status: 'updated' }
  | { status: 'skipped' }
  | { status: 'failed'; reason: 'empty_response' | 'llm_error' | 'db_error' }

/**
 * Orchestrates a single learning pass. Loads the current memo, diffs the AI
 * draft against the author's final, calls the learner LLM, truncates, and
 * upserts the result. Never throws — all failure paths return a structured
 * result so the caller (publishReview via after()) can log without taking
 * down the request.
 */
export async function runStyleMemoLearner(
  input: RunStyleMemoLearnerInput
): Promise<RunStyleMemoLearnerResult> {
  try {
    const currentMemo = await loadStyleMemo(input.organizationId)

    const diff = buildLearnerDiff({
      ai: input.ai,
      finalNarrative: input.finalNarrative,
      authorNotes: input.authorNotes,
    })

    if (diff === null) return { status: 'skipped' }

    const prompt = buildLearnerPrompt({
      organizationName: input.organizationName,
      currentMemo,
      diff,
    })

    const anthropic = await getAnthropicProvider()
    const { text } = await generateText({
      model: anthropic(LEARNER_MODEL_ID),
      prompt,
      maxOutputTokens: 800,
    })

    const cleaned = text.trim()
    if (cleaned.length === 0) {
      console.warn('[Style Memo Learner]', {
        type: 'empty_response',
        orgId: input.organizationId,
        timestamp: new Date().toISOString(),
      })
      return { status: 'failed', reason: 'empty_response' }
    }

    const memo = truncateMemo(cleaned)

    const supabase = createServiceClient()
    const { error } = await supabase.from('marketing_review_style_memos').upsert(
      {
        organization_id: input.organizationId,
        memo,
        source: 'auto',
        updated_by: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )

    if (error) {
      console.error('[Style Memo Learner]', {
        type: 'db_error',
        orgId: input.organizationId,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      return { status: 'failed', reason: 'db_error' }
    }

    return { status: 'updated' }
  } catch (err) {
    console.error('[Style Memo Learner]', {
      type: 'llm_error',
      orgId: input.organizationId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return { status: 'failed', reason: 'llm_error' }
  }
}
