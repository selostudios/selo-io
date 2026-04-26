import { randomUUID } from 'node:crypto'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
} from '../../helpers/db'

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
 *
 * Reuses the shared `testDb` service client and the `createTestUser`,
 * `createTestOrganization`, `linkUserToOrganization` helpers from
 * `tests/helpers/db.ts` — only the review/draft/snapshot rows below are
 * genuinely new fixture logic.
 */
export async function seedOrgWithDraft(
  options: { withSnapshot?: boolean } = {}
): Promise<SeededReview> {
  const suffix = randomUUID().slice(0, 12)
  const email = `review-fixture-${suffix}@test.local`

  const authUser = await createTestUser(email, 'password123', {
    first_name: 'Review',
    last_name: 'Fixture',
  })
  if (!authUser) throw new Error('failed to create auth user')
  const userId = authUser.id

  const org = await createTestOrganization(`Review Fixture Org ${suffix}`)
  const organizationId = org.id

  await linkUserToOrganization(userId, organizationId, 'admin', 'Review', 'Fixture')

  let reviewId = ''
  let draftId = ''
  let snapshotId: string | undefined

  try {
    const { data: review, error: reviewErr } = await testDb
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
    reviewId = review.id

    const { data: draft, error: draftErr } = await testDb
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
    draftId = draft.id

    if (options.withSnapshot) {
      const { data: snapshot, error: snapErr } = await testDb
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
  } catch (err) {
    // If we got partway through but blew up, undo the user/org we just created
    // so the failed seed doesn't leak orphan rows. Cleanup never throws.
    await teardown(organizationId, userId)
    throw err
  }

  const cleanup = async () => {
    await teardown(organizationId, userId)
  }

  return { organizationId, userId, reviewId, draftId, snapshotId, cleanup }
}

/**
 * Tears down a fixture's org + user. Deleting the organization cascades
 * through team_members, marketing_reviews, drafts, and snapshots via FK.
 * The `users` row and auth user are deleted last.
 */
async function teardown(organizationId: string, userId: string): Promise<void> {
  await testDb.from('organizations').delete().eq('id', organizationId)
  await testDb.from('users').delete().eq('id', userId)
  const { error } = await testDb.auth.admin.deleteUser(userId)
  if (error) {
    console.warn('[reviews-fixture cleanup] failed to delete auth user', error)
  }
}
