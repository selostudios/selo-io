'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { periodsForQuarter } from '@/lib/reviews/period'
import { fetchAllData } from '@/lib/reviews/fetchers'
import {
  generateNarrativeBlocks,
  NarrativeGenerationError,
} from '@/lib/reviews/narrative/generator'
import { runStyleMemoLearner } from '@/lib/reviews/narrative/learn'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

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

export async function checkReviewExists(
  organizationId: string,
  quarter: string
): Promise<
  { exists: false } | { exists: true; reviewId: string; hasPublishedSnapshots: boolean } | ActionErr
> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_reviews')
    .select('id, latest_snapshot_id')
    .eq('organization_id', organizationId)
    .eq('quarter', quarter)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { exists: false }

  return {
    exists: true,
    reviewId: data.id as string,
    hasPublishedSnapshots: data.latest_snapshot_id !== null,
  }
}

export async function createReview(input: {
  organizationId: string
  quarter: string
  title?: string
  overwrite?: boolean
  authorNotes?: string | null
}): Promise<(ActionOk & { reviewId: string }) | ActionErr> {
  const auth = await authorizeAdminOrInternal(input.organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const title = input.title ?? `${input.quarter} Marketing Review`
  const normalizedNotes = input.authorNotes?.trim() ?? ''
  const authorNotes = normalizedNotes.length > 0 ? normalizedNotes : null

  if (input.overwrite) {
    const { error: deleteError } = await supabase
      .from('marketing_reviews')
      .delete()
      .eq('organization_id', input.organizationId)
      .eq('quarter', input.quarter)
    if (deleteError) {
      return { success: false, error: `Failed to replace existing review: ${deleteError.message}` }
    }
  }

  const { data: review, error: reviewError } = await supabase
    .from('marketing_reviews')
    .insert({
      organization_id: input.organizationId,
      quarter: input.quarter,
      title,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (reviewError || !review) {
    return { success: false, error: reviewError?.message ?? 'Failed to create review' }
  }

  const periods = periodsForQuarter(input.quarter)
  const data = await fetchAllData(input.organizationId, periods)

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', input.organizationId)
    .single()

  let narrative
  try {
    narrative = await generateNarrativeBlocks({
      organizationId: input.organizationId,
      organizationName: (org?.name as string | undefined) ?? 'the organization',
      quarter: input.quarter,
      periodStart: periods.main.start,
      periodEnd: periods.main.end,
      data,
      reviewId: review.id,
      authorNotes,
    })
  } catch (error) {
    await supabase.from('marketing_reviews').delete().eq('id', review.id)
    const message =
      error instanceof NarrativeGenerationError
        ? `AI narrative generation failed: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'AI narrative generation failed'
    return { success: false, error: message }
  }

  const { error: draftError } = await supabase.from('marketing_review_drafts').insert({
    review_id: review.id,
    data,
    narrative,
    ai_originals: narrative,
    author_notes: authorNotes,
  })

  if (draftError) {
    return { success: false, error: draftError.message }
  }

  revalidatePath(`/${input.organizationId}/reports/performance`)
  return { success: true, reviewId: review.id }
}

async function loadReviewForAuth(
  reviewId: string
): Promise<{ organization_id: string; quarter: string; organization_name: string } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketing_reviews')
    .select('organization_id, quarter, organizations!inner(name)')
    .eq('id', reviewId)
    .maybeSingle()

  if (!data) return null

  const row = data as {
    organization_id: string
    quarter: string
    organizations: { name: string } | { name: string }[] | null
  }

  const orgField = row.organizations
  const organizationName = Array.isArray(orgField)
    ? (orgField[0]?.name ?? 'Organization')
    : (orgField?.name ?? 'Organization')

  return {
    organization_id: row.organization_id,
    quarter: row.quarter,
    organization_name: organizationName,
  }
}

export async function refreshDraftData(reviewId: string): Promise<ActionOk | ActionErr> {
  const review = await loadReviewForAuth(reviewId)
  if (!review) return { success: false, error: 'Review not found' }

  const auth = await authorizeAdminOrInternal(review.organization_id)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const periods = periodsForQuarter(review.quarter)
  const data = await fetchAllData(review.organization_id, periods)

  // narrative + ai_originals intentionally untouched — edits are preserved
  const { error } = await supabase
    .from('marketing_review_drafts')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${review.organization_id}/reports/performance/${reviewId}`)
  return { success: true }
}

export async function updateNarrative(
  reviewId: string,
  block: keyof NarrativeBlocks,
  value: string
): Promise<ActionOk | ActionErr> {
  const review = await loadReviewForAuth(reviewId)
  if (!review) return { success: false, error: 'Review not found' }

  const auth = await authorizeAdminOrInternal(review.organization_id)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()

  const { data: draft, error: loadError } = await supabase
    .from('marketing_review_drafts')
    .select('narrative')
    .eq('review_id', reviewId)
    .single()

  if (loadError || !draft) {
    return { success: false, error: loadError?.message ?? 'Draft not found' }
  }

  const narrative = {
    ...((draft.narrative as NarrativeBlocks) ?? {}),
    [block]: value,
  }

  const { error } = await supabase
    .from('marketing_review_drafts')
    .update({ narrative, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${review.organization_id}/reports/performance/${reviewId}`)
  return { success: true }
}

export async function updateAuthorNotes(
  reviewId: string,
  notes: string
): Promise<ActionOk | ActionErr> {
  const review = await loadReviewForAuth(reviewId)
  if (!review) return { success: false, error: 'Review not found' }

  const auth = await authorizeAdminOrInternal(review.organization_id)
  if (!auth.ok) return { success: false, error: auth.error }

  const trimmed = notes.trim()
  const value = trimmed.length > 0 ? trimmed : null

  const supabase = await createClient()
  const { error } = await supabase
    .from('marketing_review_drafts')
    .update({ author_notes: value, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${review.organization_id}/reports/performance/${reviewId}`)
  return { success: true }
}

export async function deleteReview(reviewId: string): Promise<ActionOk | ActionErr> {
  const review = await loadReviewForAuth(reviewId)
  if (!review) return { success: false, error: 'Review not found' }

  const auth = await authorizeAdminOrInternal(review.organization_id)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('marketing_reviews').delete().eq('id', reviewId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${review.organization_id}/reports/performance`)
  return { success: true }
}

export async function publishReview(
  reviewId: string
): Promise<(ActionOk & { snapshotId: string; version: number }) | ActionErr> {
  const review = await loadReviewForAuth(reviewId)
  if (!review) return { success: false, error: 'Review not found' }

  const auth = await authorizeAdminOrInternal(review.organization_id)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()

  const { data: draft, error: draftError } = await supabase
    .from('marketing_review_drafts')
    .select('data, narrative, author_notes, ai_originals')
    .eq('review_id', reviewId)
    .single()

  if (draftError || !draft) {
    return { success: false, error: draftError?.message ?? 'Draft not found' }
  }

  const narrativeBlocks = (draft.narrative ?? {}) as NarrativeBlocks
  const hasContent = Object.values(narrativeBlocks).some(
    (v) => typeof v === 'string' && v.trim().length > 0
  )
  if (!hasContent) {
    return { success: false, error: 'Nothing to publish — narrative is empty' }
  }

  const { data: lastSnapshot } = await supabase
    .from('marketing_review_snapshots')
    .select('version')
    .eq('review_id', reviewId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = ((lastSnapshot?.version as number | undefined) ?? 0) + 1
  const periods = periodsForQuarter(review.quarter)

  const { data: snapshot, error: insertError } = await supabase
    .from('marketing_review_snapshots')
    .insert({
      review_id: reviewId,
      version: nextVersion,
      published_by: auth.userId,
      period_start: periods.main.start,
      period_end: periods.main.end,
      compare_qoq_start: periods.qoq.start,
      compare_qoq_end: periods.qoq.end,
      compare_yoy_start: periods.yoy.start,
      compare_yoy_end: periods.yoy.end,
      data: draft.data as SnapshotData,
      narrative: draft.narrative as NarrativeBlocks,
      share_token: nanoid(21),
      author_notes: (draft.author_notes as string | null) ?? null,
      ai_originals: (draft.ai_originals as NarrativeBlocks | null) ?? null,
    })
    .select('id')
    .single()

  if (insertError || !snapshot) {
    return { success: false, error: insertError?.message ?? 'Failed to publish snapshot' }
  }

  const { error: updateError } = await supabase
    .from('marketing_reviews')
    .update({ latest_snapshot_id: snapshot.id, updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath(`/${review.organization_id}/reports/performance/${reviewId}`)

  after(async () => {
    await runStyleMemoLearner({
      organizationId: review.organization_id,
      organizationName: review.organization_name,
      ai: (draft.ai_originals as NarrativeBlocks | null) ?? ({} as NarrativeBlocks),
      finalNarrative: draft.narrative as NarrativeBlocks,
      authorNotes: (draft.author_notes as string | null) ?? null,
      snapshotId: snapshot.id as string,
      reviewId,
    })
  })

  return { success: true, snapshotId: snapshot.id as string, version: nextVersion }
}
