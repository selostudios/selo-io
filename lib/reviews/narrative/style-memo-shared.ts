// Pure, client-safe helpers and types for the style memo feature. Kept free
// of any server-only imports (e.g. `next/headers`, the Supabase service
// client) so client components like the settings `StyleMemoCard` can import
// `MAX_MEMO_CHARS` without pulling server code into the browser bundle.

import type { NarrativeBlocks, SlideNotes } from '@/lib/reviews/types'
import { NARRATIVE_BLOCK_KEYS, type NarrativeBlockKey } from './prompts'

export const MAX_MEMO_CHARS = 2000

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
  slideNotes: Array<{ key: NarrativeBlockKey; note: string }>
}

export interface BuildLearnerDiffInput {
  ai: NarrativeBlocks
  finalNarrative: NarrativeBlocks
  authorNotes: string | null
  slideNotes: SlideNotes
}

/**
 * Builds the input for the learner by collecting blocks the author rewrote
 * alongside this quarter's author notes and per-slide notes. Returns `null`
 * when there is nothing to learn from (no edits, no notes, no slide notes),
 * which the caller uses to skip the LLM call entirely.
 *
 * Comparison is whole-string equality — fine-grained semantic diffing is left
 * to the LLM since it has the full context anyway.
 */
export function buildLearnerDiff({
  ai,
  finalNarrative,
  authorNotes,
  slideNotes,
}: BuildLearnerDiffInput): LearnerDiff | null {
  const changedBlocks: LearnerDiff['changedBlocks'] = []
  const slideNoteEntries: LearnerDiff['slideNotes'] = []
  for (const key of NARRATIVE_BLOCK_KEYS) {
    const aiText = (ai[key] ?? '').trim()
    const finalText = (finalNarrative[key] ?? '').trim()
    if (aiText !== finalText) {
      changedBlocks.push({ key, aiText: ai[key] ?? '', finalText: finalNarrative[key] ?? '' })
    }
    const note = (slideNotes[key] ?? '').trim()
    if (note.length > 0) {
      slideNoteEntries.push({ key, note })
    }
  }

  const trimmedNotes = authorNotes?.trim() ?? ''
  if (changedBlocks.length === 0 && trimmedNotes.length === 0 && slideNoteEntries.length === 0) {
    return null
  }

  return {
    changedBlocks,
    authorNotes: trimmedNotes.length > 0 ? trimmedNotes : null,
    slideNotes: slideNoteEntries,
  }
}
