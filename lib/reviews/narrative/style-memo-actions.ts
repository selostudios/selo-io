'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { truncateMemo } from './style-memo'
import { runStyleMemoLearner } from './learn'
import type { NarrativeBlocks } from '@/lib/reviews/types'

type ActionOk = { success: true }
type ActionErr = { success: false; error: string }

async function authorizeAdminOrInternal(
  organizationId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) return { ok: false, error: 'User not found' }

  const internal = isInternalUser(userRecord)
  const isOrgAdmin =
    userRecord.organization_id === organizationId && userRecord.role === UserRole.Admin

  if (!internal && !isOrgAdmin) {
    return { ok: false, error: 'Insufficient permissions' }
  }

  return { ok: true, userId: user.id }
}

/**
 * Save a manually-edited style memo. The memo is truncated to the standard
 * cap before persistence so the stored value always satisfies the same
 * invariant as auto-generated memos.
 */
export async function saveStyleMemo(
  organizationId: string,
  memo: string
): Promise<ActionOk | ActionErr> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const truncated = truncateMemo(memo)
  const supabase = await createClient()

  const { error } = await supabase.from('marketing_review_style_memos').upsert(
    {
      organization_id: organizationId,
      memo: truncated,
      source: 'manual',
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${organizationId}/reports/performance/settings`)
  return { success: true }
}

/**
 * Clears the style memo by persisting an empty string with manual source.
 * Implemented as a thin alias over saveStyleMemo — the resulting DB state is
 * identical to "author typed nothing into the memo box and saved".
 */
export async function clearStyleMemo(organizationId: string): Promise<ActionOk | ActionErr> {
  return saveStyleMemo(organizationId, '')
}

/**
 * Re-runs the learner against the most recent published snapshot for the
 * organization. Useful when the author has just overridden/cleared the memo
 * and wants to regenerate it from the latest quarter's edits without waiting
 * for the next publish.
 */
export async function regenerateStyleMemoFromLatestSnapshot(
  organizationId: string
): Promise<ActionOk | ActionErr> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()

  const { data: snapshot, error: snapshotError } = await supabase
    .from('marketing_review_snapshots')
    .select(
      'id, review_id, ai_originals, narrative, author_notes, marketing_reviews!inner(organization_id)'
    )
    .eq('marketing_reviews.organization_id', organizationId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (snapshotError || !snapshot) {
    return { success: false, error: 'No published snapshot to learn from' }
  }

  const snapshotRow = snapshot as {
    id: string
    review_id: string
    ai_originals: NarrativeBlocks | null
    narrative: NarrativeBlocks | null
    author_notes: string | null
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const organizationName = ((org as { name?: string } | null)?.name ?? 'Organization') as string

  const ai = (snapshotRow.ai_originals ?? {}) as NarrativeBlocks
  const finalNarrative = (snapshotRow.narrative ?? {}) as NarrativeBlocks
  const authorNotes = snapshotRow.author_notes ?? null

  const result = await runStyleMemoLearner({
    organizationId,
    organizationName,
    ai,
    finalNarrative,
    authorNotes,
    snapshotId: snapshotRow.id,
    reviewId: snapshotRow.review_id,
  })

  if (result.status === 'failed') {
    return { success: false, error: `Learner failed: ${result.reason}` }
  }

  revalidatePath(`/${organizationId}/reports/performance/settings`)
  return { success: true }
}
