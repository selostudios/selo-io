import { afterAll, describe, expect, test, vi } from 'vitest'
import type { CachedUserRecord, Membership } from '@/lib/auth/cached'
import { seedOrgWithDraftAsAdmin, type SeededReview } from '../helpers/reviews'

/**
 * The action under test reads its Supabase client via `createClient()` and its
 * authenticated user via `getAuthUser()` / `getUserRecord()`. In vitest there
 * is no request context (no cookies, no session), so we mock both modules to
 * route everything through the service-role `testDb` client. The auth-user id
 * is controlled by `mockAuthUserId` so each test can act as a different user.
 *
 * `publishReview` also schedules the style-memo learner via `next/server`'s
 * `after()`. We replace `after()` with a fire-and-forget shim and stub the
 * learner so the test doesn't reach Claude.
 *
 * IMPORTANT: these `vi.mock` calls must be at module scope and must come
 * before the `import { publishReview } …` below — otherwise vitest will
 * resolve the real modules first and the mocks will not apply.
 */
let mockAuthUserId: string | null = null

vi.mock('@/lib/supabase/server', async () => {
  const { testDb: db } = await import('../../helpers/db')
  return {
    createClient: async () => db,
    createServiceClient: () => db,
  }
})

vi.mock('@/lib/auth/cached', async () => {
  const { testDb: db } = await import('../../helpers/db')
  return {
    getAuthUser: async () => (mockAuthUserId ? { id: mockAuthUserId } : null),
    getUserRecord: async (userId: string): Promise<CachedUserRecord | null> => {
      const { data } = await db
        .from('users')
        .select(
          'id, is_internal, first_name, last_name, team_members(organization_id, role, organization:organizations(id, name, logo_url, website_url, status))'
        )
        .eq('id', userId)
        .single()
      if (!data) return null

      const memberships = (data.team_members as Membership[] | null) ?? []
      const primary = memberships[0]

      return {
        id: data.id as string,
        organization_id: primary?.organization_id ?? null,
        role: primary?.role ?? 'client_viewer',
        first_name: data.first_name as string | null,
        last_name: data.last_name as string | null,
        is_internal: data.is_internal as boolean | null,
        organization: primary?.organization ?? null,
        memberships,
      }
    },
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
}))

vi.mock('next/server', () => ({
  // No-op: the real `after()` schedules work after the response is sent.
  // We swallow the callback so the style-memo learner never runs in tests.
  after: () => undefined,
}))

vi.mock('@/lib/reviews/narrative/learn', () => ({
  runStyleMemoLearner: async () => ({ status: 'skipped' }),
}))

// Import the action AFTER the vi.mock calls above.
import { publishReview } from '@/lib/reviews/actions'
import { createServiceClient } from '@/lib/supabase/server'

const seeded: SeededReview[] = []

afterAll(async () => {
  for (const fixture of seeded) {
    await fixture.cleanup()
  }
})

async function track(promise: Promise<SeededReview>): Promise<SeededReview> {
  const fixture = await promise
  seeded.push(fixture)
  return fixture
}

async function loadSnapshot(snapshotId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('marketing_review_snapshots')
    .select('hidden_slides')
    .eq('id', snapshotId)
    .single()
  return data
}

describe('publishReview hidden_slides propagation', () => {
  test('copies draft.hidden_slides into the snapshot row', async () => {
    const fixture = await track(
      seedOrgWithDraftAsAdmin({
        hiddenSlides: ['ga_summary', 'planning'],
        narrative: { ga_summary: 'x' },
      })
    )
    mockAuthUserId = fixture.userId

    const result = await publishReview(fixture.reviewId)
    expect(result.success).toBe(true)

    const snapshotId = result.success ? result.snapshotId : ''
    expect(snapshotId).toBeTruthy()

    const snap = await loadSnapshot(snapshotId)
    expect(((snap?.hidden_slides as string[] | null) ?? []).slice().sort()).toEqual([
      'ga_summary',
      'planning',
    ])
  })

  test('snapshot defaults to empty when draft has no hidden slides', async () => {
    const fixture = await track(
      seedOrgWithDraftAsAdmin({
        narrative: { ga_summary: 'x' },
      })
    )
    mockAuthUserId = fixture.userId

    const result = await publishReview(fixture.reviewId)
    expect(result.success).toBe(true)

    const snapshotId = result.success ? result.snapshotId : ''
    expect(snapshotId).toBeTruthy()

    const snap = await loadSnapshot(snapshotId)
    expect(snap?.hidden_slides).toEqual([])
  })
})
