import { generateObject } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { getAnthropicProvider } from '@/lib/ai/provider'
import { buildLearnerDiff, loadStyleMemo, truncateMemo } from './style-memo'
import { buildLearnerPrompt } from './learner-prompts'
import { learnerOutputSchema, truncateRationale } from './memo-history-types'
import { insertMemoVersion } from './memo-history'
import type { NarrativeBlocks } from '@/lib/reviews/types'

const LEARNER_MODEL_ID = 'claude-opus-4-7'
const LEARNER_MAX_TOKENS = 800

export interface RunStyleMemoLearnerInput {
  organizationId: string
  organizationName: string
  ai: NarrativeBlocks
  finalNarrative: NarrativeBlocks
  authorNotes: string | null
  snapshotId?: string
  reviewId?: string
}

export type RunStyleMemoLearnerResult =
  | { status: 'updated'; memo: string; rationale: string }
  | { status: 'skipped' }
  | { status: 'failed'; reason: 'empty_response' | 'llm_error' | 'db_error' | 'unknown' }

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

    let object: { memo: string; rationale: string }
    try {
      const result = await generateObject({
        model: anthropic(LEARNER_MODEL_ID),
        prompt,
        schema: learnerOutputSchema,
        maxOutputTokens: LEARNER_MAX_TOKENS,
      })
      object = result.object
    } catch (err) {
      console.error('[Style Memo Error]', {
        type: 'llm_error',
        orgId: input.organizationId,
        ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
        ...(input.reviewId ? { reviewId: input.reviewId } : {}),
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
      return { status: 'failed', reason: 'llm_error' }
    }

    const cleanedMemo = object.memo.trim()
    if (cleanedMemo.length === 0) {
      console.error('[Style Memo Error]', {
        type: 'empty_response',
        orgId: input.organizationId,
        ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
        ...(input.reviewId ? { reviewId: input.reviewId } : {}),
        timestamp: new Date().toISOString(),
      })
      return { status: 'failed', reason: 'empty_response' }
    }

    const memo = truncateMemo(cleanedMemo)
    const rationale = truncateRationale(object.rationale)

    const supabase = createServiceClient()
    try {
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
        console.error('[Style Memo Error]', {
          type: 'db_error',
          orgId: input.organizationId,
          ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
          ...(input.reviewId ? { reviewId: input.reviewId } : {}),
          error: error.message,
          timestamp: new Date().toISOString(),
        })
        return { status: 'failed', reason: 'db_error' }
      }
    } catch (err) {
      console.error('[Style Memo Error]', {
        type: 'db_error',
        orgId: input.organizationId,
        ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
        ...(input.reviewId ? { reviewId: input.reviewId } : {}),
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
      return { status: 'failed', reason: 'db_error' }
    }

    // Version insert is best-effort and lives outside the db_error try/catch.
    // The helper never throws (it catches internally and returns a structured
    // result), but keeping it here ensures a thrown error could never demote
    // a successful memo update to { status: 'failed', reason: 'db_error' }.
    const versionResult = await insertMemoVersion({
      supabase,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId ?? null,
      memo,
      rationale,
      source: 'auto',
      createdBy: null,
    })

    if (versionResult.inserted === false && versionResult.reason === 'error') {
      console.error('[Style Memo Error]', {
        type: 'version_insert_error',
        orgId: input.organizationId,
        ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
        ...(input.reviewId ? { reviewId: input.reviewId } : {}),
        error: versionResult.error,
        timestamp: new Date().toISOString(),
      })
    }

    return { status: 'updated', memo, rationale }
  } catch (err) {
    console.error('[Style Memo Error]', {
      type: 'unknown',
      orgId: input.organizationId,
      ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
      ...(input.reviewId ? { reviewId: input.reviewId } : {}),
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return { status: 'failed', reason: 'unknown' }
  }
}
