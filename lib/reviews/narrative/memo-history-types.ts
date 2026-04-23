// Pure, client-safe types and helpers for the memo history feature. Kept free
// of any server-only imports (e.g. `next/headers`, the Supabase service
// client) so client components like the history timeline can import these
// without pulling server code into the browser bundle.

import { z } from 'zod'
import type { Tables } from '@/lib/supabase/database.types'

export type MemoHistorySource = 'auto' | 'manual'

export type MemoVersionDbRow = Tables<'marketing_review_style_memo_versions'>

export interface MemoHistoryRow {
  id: string
  organizationId: string
  snapshotId: string | null
  memo: string
  rationale: string | null
  source: MemoHistorySource
  createdBy: string | null
  createdAt: string
}

export function toMemoHistoryRow(row: MemoVersionDbRow): MemoHistoryRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    snapshotId: row.snapshot_id,
    memo: row.memo,
    rationale: row.rationale,
    source: row.source as MemoHistorySource,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export const learnerOutputSchema = z.object({
  memo: z.string(),
  rationale: z.string(),
})

export type LearnerOutput = z.infer<typeof learnerOutputSchema>

export const RATIONALE_MAX_CHARS = 500

/**
 * Trims surrounding whitespace and truncates the rationale to
 * RATIONALE_MAX_CHARS. When truncation is needed, the final character is
 * replaced with a single-character ellipsis so the total length still equals
 * RATIONALE_MAX_CHARS.
 */
export function truncateRationale(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= RATIONALE_MAX_CHARS) return trimmed
  return trimmed.slice(0, RATIONALE_MAX_CHARS - 1) + '…'
}
