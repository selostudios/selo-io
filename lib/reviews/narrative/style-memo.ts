import { createServiceClient } from '@/lib/supabase/server'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { NARRATIVE_BLOCK_KEYS, type NarrativeBlockKey } from './prompts'

export const MAX_MEMO_CHARS = 2000

/**
 * Loads the style memo for an organization. Returns an empty string when no
 * row exists or the lookup fails — the prompt pipeline treats empty memos as
 * "no learned style yet" and omits the section entirely.
 *
 * Uses the service client because this runs inside the narrative generator
 * which executes without a user session (e.g. background learning passes).
 */
export async function loadStyleMemo(organizationId: string): Promise<string> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('marketing_review_style_memos')
      .select('memo')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error || !data) return ''
    const memo = data.memo as string | null
    return memo ?? ''
  } catch (err) {
    console.error('[Style Memo Load Error]', {
      type: 'lookup_failed',
      organizationId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return ''
  }
}

/**
 * Caps the memo at MAX_MEMO_CHARS, preferring to cut at the last paragraph
 * break (blank line) before the limit so the memo never ends mid-sentence.
 * Falls back to a hard cut when the memo contains no paragraph breaks in the
 * first MAX_MEMO_CHARS.
 */
export function truncateMemo(memo: string): string {
  if (memo.length <= MAX_MEMO_CHARS) return memo
  const prefix = memo.slice(0, MAX_MEMO_CHARS)
  const lastBreak = prefix.lastIndexOf('\n\n')
  if (lastBreak <= 0) return prefix
  return memo.slice(0, lastBreak)
}

export interface LearnerDiff {
  changedBlocks: Array<{
    key: NarrativeBlockKey
    aiText: string
    finalText: string
  }>
  authorNotes: string | null
}

export interface BuildLearnerDiffInput {
  ai: NarrativeBlocks
  finalNarrative: NarrativeBlocks
  authorNotes: string | null
}

/**
 * Builds the input for the learner by collecting blocks the author rewrote
 * alongside this quarter's author notes. Returns `null` when there is nothing
 * to learn from (no edits and no notes), which the caller uses to skip the
 * LLM call entirely.
 *
 * Comparison is whole-string equality — fine-grained semantic diffing is left
 * to the LLM since it has the full context anyway.
 */
export function buildLearnerDiff({
  ai,
  finalNarrative,
  authorNotes,
}: BuildLearnerDiffInput): LearnerDiff | null {
  const changedBlocks: LearnerDiff['changedBlocks'] = []
  for (const key of NARRATIVE_BLOCK_KEYS) {
    const aiText = (ai[key] ?? '').trim()
    const finalText = (finalNarrative[key] ?? '').trim()
    if (aiText === finalText) continue
    changedBlocks.push({ key, aiText: ai[key] ?? '', finalText: finalNarrative[key] ?? '' })
  }

  const trimmedNotes = authorNotes?.trim() ?? ''
  if (changedBlocks.length === 0 && trimmedNotes.length === 0) return null

  return { changedBlocks, authorNotes: trimmedNotes.length > 0 ? trimmedNotes : null }
}
