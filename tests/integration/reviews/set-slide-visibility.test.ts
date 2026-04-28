import { afterAll, describe, expect, test, vi } from 'vitest'
import type { CachedUserRecord, Membership } from '@/lib/auth/cached'
import {
  seedOrgWithDraftAsAdmin,
  seedOrgWithDraftAsTeamMember,
  type SeededReview,
} from '../helpers/reviews'

/**
 * The action under test reads its Supabase client via `createClient()` and its
 * authenticated user via `getAuthUser()` / `getUserRecord()`. In vitest there
 * is no request context (no cookies, no session), so we mock both modules to
 * route everything through the service-role `testDb` client. The auth-user id
 * is controlled by `mockAuthUserId` so each test can act as a different user.
 *
 * IMPORTANT: these `vi.mock` calls must be at module scope and must come
 * before the `import { setSlideVisibility } …` below — otherwise vitest will
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

// Import the action AFTER the vi.mock calls above.
import { setSlideVisibility } from '@/lib/reviews/actions'
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

describe('setSlideVisibility', () => {
  test('hides a body slide and persists to draft', async () => {
    const fixture = await track(seedOrgWithDraftAsAdmin())
    mockAuthUserId = fixture.userId

    const result = await setSlideVisibility(fixture.reviewId, 'ga_summary', true)
    expect(result).toEqual({ success: true })

    const supabase = createServiceClient()
    const { data } = await supabase
      .from('marketing_review_drafts')
      .select('hidden_slides')
      .eq('review_id', fixture.reviewId)
      .single()
    expect(data?.hidden_slides).toEqual(['ga_summary'])
  })

  test('un-hides a slide by removing it from the array', async () => {
    const fixture = await track(seedOrgWithDraftAsAdmin({ hiddenSlides: ['ga_summary'] }))
    mockAuthUserId = fixture.userId

    const result = await setSlideVisibility(fixture.reviewId, 'ga_summary', false)
    expect(result).toEqual({ success: true })

    const supabase = createServiceClient()
    const { data } = await supabase
      .from('marketing_review_drafts')
      .select('hidden_slides')
      .eq('review_id', fixture.reviewId)
      .single()
    expect(data?.hidden_slides).toEqual([])
  })

  test('rejects cover slide', async () => {
    const fixture = await track(seedOrgWithDraftAsAdmin())
    mockAuthUserId = fixture.userId

    const result = await setSlideVisibility(fixture.reviewId, 'cover', true)
    expect(result).toEqual({ success: false, error: expect.stringMatching(/cover/i) })
  })

  test('rejects unknown slide keys', async () => {
    const fixture = await track(seedOrgWithDraftAsAdmin())
    mockAuthUserId = fixture.userId

    const result = await setSlideVisibility(fixture.reviewId, 'not_a_slide' as never, true)
    expect(result.success).toBe(false)
  })

  test('rejects non-admin users', async () => {
    const fixture = await track(seedOrgWithDraftAsTeamMember())
    mockAuthUserId = fixture.userId

    const result = await setSlideVisibility(fixture.reviewId, 'ga_summary', true)
    expect(result).toEqual({ success: false, error: expect.stringMatching(/permission/i) })
  })
})
