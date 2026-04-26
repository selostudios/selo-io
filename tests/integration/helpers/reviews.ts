import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

/**
 * Service-role client used only by integration test helpers to seed and
 * tear down per-test review fixtures. Bypasses RLS so we can manipulate
 * rows owned by arbitrary fake auth users.
 */
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for integration tests'
    )
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

export type SeededReview = {
  organizationId: string
  userId: string
  reviewId: string
  draftId: string
  snapshotId?: string
  /** Cleans up all rows seeded for this fixture. Cascades via organization. */
  cleanup: () => Promise<void>
}

/**
 * Seed a fresh org + admin user + marketing_review + draft (and optionally a
 * published snapshot) for an integration test. Uses random UUIDs so tests
 * never collide with one another or with the global E2E seed fixtures.
 */
export async function seedOrgWithDraft(
  options: { withSnapshot?: boolean } = {}
): Promise<SeededReview> {
  const supabase = getServiceClient()

  const suffix = randomUUID().slice(0, 12)
  const email = `review-fixture-${suffix}@test.local`

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true,
  })
  if (authErr || !authUser?.user) throw authErr ?? new Error('failed to create auth user')
  const userId = authUser.user.id

  const { error: profileErr } = await supabase.from('users').insert({
    id: userId,
    first_name: 'Review',
    last_name: 'Fixture',
  })
  if (profileErr) throw profileErr

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: `Review Fixture Org ${suffix}`,
      primary_color: '#000000',
      secondary_color: '#F5F5F0',
      accent_color: '#666666',
    })
    .select('id')
    .single()
  if (orgErr || !org) throw orgErr ?? new Error('failed to create org')
  const organizationId = org.id

  const { error: memberErr } = await supabase.from('team_members').insert({
    user_id: userId,
    organization_id: organizationId,
    role: 'admin',
  })
  if (memberErr) throw memberErr

  const { data: review, error: reviewErr } = await supabase
    .from('marketing_reviews')
    .insert({
      organization_id: organizationId,
      title: `Fixture Review ${suffix}`,
      quarter: '2026-Q1',
      created_by: userId,
    })
    .select('id')
    .single()
  if (reviewErr || !review) throw reviewErr ?? new Error('failed to create review')
  const reviewId = review.id

  const { data: draft, error: draftErr } = await supabase
    .from('marketing_review_drafts')
    .insert({
      review_id: reviewId,
      data: {},
      narrative: {},
      ai_originals: {},
    })
    .select('id')
    .single()
  if (draftErr || !draft) throw draftErr ?? new Error('failed to create draft')
  const draftId = draft.id

  let snapshotId: string | undefined
  if (options.withSnapshot) {
    const { data: snapshot, error: snapErr } = await supabase
      .from('marketing_review_snapshots')
      .insert({
        review_id: reviewId,
        version: 1,
        published_by: userId,
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        compare_qoq_start: '2025-10-01',
        compare_qoq_end: '2025-12-31',
        compare_yoy_start: '2025-01-01',
        compare_yoy_end: '2025-03-31',
        data: {},
        narrative: {},
        share_token: `fixture-token-${suffix}`,
      })
      .select('id')
      .single()
    if (snapErr || !snapshot) throw snapErr ?? new Error('failed to create snapshot')
    snapshotId = snapshot.id
  }

  const cleanup = async () => {
    // Deleting the org cascades through team_members, marketing_reviews,
    // drafts and snapshots. Then we drop the user record + auth user.
    await supabase.from('organizations').delete().eq('id', organizationId)
    await supabase.from('users').delete().eq('id', userId)
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
  }

  return { organizationId, userId, reviewId, draftId, snapshotId, cleanup }
}
