import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemoHistorySource } from './memo-history-types'

export interface InsertMemoVersionInput {
  supabase: SupabaseClient
  organizationId: string
  snapshotId: string | null
  memo: string
  rationale: string | null
  source: MemoHistorySource
  createdBy: string | null
}

export type InsertMemoVersionResult =
  | { inserted: true }
  | { inserted: false; reason: 'duplicate' }
  | { inserted: false; reason: 'error'; error: string }

/**
 * Inserts a new row into `marketing_review_style_memo_versions` capturing the
 * memo body at this point in time. Before inserting, reads the most-recent
 * version row for the org and skips the write when the prior memo exactly
 * matches the new memo — this prevents the history timeline from filling up
 * with duplicate entries when nothing actually changed (e.g. a learner pass
 * that produces an identical memo, or a manual save that doesn't alter the
 * text).
 *
 * Accepts the Supabase client as a parameter so both the service-role
 * learner path and the user-auth settings-action path can share this helper
 * without forcing one client type onto the other.
 *
 * Never throws — all failure paths return a structured result so callers can
 * log without taking down the surrounding request.
 */
export async function insertMemoVersion(
  input: InsertMemoVersionInput
): Promise<InsertMemoVersionResult> {
  const { supabase, organizationId, snapshotId, memo, rationale, source, createdBy } = input

  try {
    const { data: prior } = await supabase
      .from('marketing_review_style_memo_versions')
      .select('memo')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prior && typeof prior.memo === 'string' && prior.memo === memo) {
      return { inserted: false, reason: 'duplicate' }
    }

    const { error } = await supabase.from('marketing_review_style_memo_versions').insert({
      organization_id: organizationId,
      snapshot_id: snapshotId,
      memo,
      rationale,
      source,
      created_by: createdBy,
    })

    if (error) {
      return { inserted: false, reason: 'error', error: error.message }
    }

    return { inserted: true }
  } catch (err) {
    return {
      inserted: false,
      reason: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
