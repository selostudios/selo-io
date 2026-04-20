import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/cached', () => ({
  getAuthUser: vi.fn(),
  getUserRecord: vi.fn(),
}))

vi.mock('nanoid', () => ({ nanoid: () => 'test-share-token-21chars' }))

vi.mock('@/lib/reviews/period', () => ({
  periodsForQuarter: () => ({
    main: { start: '2026-01-01', end: '2026-03-31' },
    qoq: { start: '2025-10-01', end: '2025-12-31' },
    yoy: { start: '2025-01-01', end: '2025-03-31' },
  }),
}))

import { publishReview } from '@/lib/reviews/actions'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  }
  return chain
}

describe('publishReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)
  })

  test('rejects when no authenticated user', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          maybeSingle: async () => ({
            data: { organization_id: 'org-1', quarter: 'Q1 2026' },
            error: null,
          }),
        })
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  test('rejects non-admin non-internal users', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'team_member',
      is_internal: false,
    } as never)
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          maybeSingle: async () => ({
            data: { organization_id: 'org-1', quarter: 'Q1 2026' },
            error: null,
          }),
        })
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' })
  })

  test('returns error when review not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain({ maybeSingle: async () => ({ data: null, error: null }) })),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Review not found' })
  })

  test('returns error when no draft exists', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: 'Q1 2026' },
        error: null,
      }),
    })
    const draftChain = makeChain({
      single: async () => ({ data: null, error: { message: 'not found' } }),
    })
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'marketing_review_drafts' ? draftChain : reviewChain
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result.success).toBe(false)
  })

  test('returns error when narrative is empty across all blocks', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: 'Q1 2026' },
        error: null,
      }),
    })
    const draftChain = makeChain({
      single: async () => ({
        data: { data: {}, narrative: { cover_subtitle: '', ga_summary: '   ' } },
        error: null,
      }),
    })
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'marketing_review_drafts' ? draftChain : reviewChain
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Nothing to publish — narrative is empty' })
  })

  test('computes next version as 1 when no prior snapshots', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: 'Q1 2026' },
        error: null,
      }),
    })
    const draftChain = makeChain({
      single: async () => ({
        data: { data: { ga: {} }, narrative: { cover_subtitle: 'hello' } },
        error: null,
      }),
    })
    const priorSnapshotChain = makeChain({
      maybeSingle: async () => ({ data: null, error: null }),
    })
    const insertChain = makeChain({
      single: async () => ({ data: { id: 'snap-1' }, error: null }),
    })
    const updateChain = makeChain()

    let reviewCallCount = 0
    let snapshotCallCount = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'marketing_reviews') {
          reviewCallCount++
          return reviewCallCount === 1 ? reviewChain : updateChain
        }
        if (table === 'marketing_review_drafts') return draftChain
        if (table === 'marketing_review_snapshots') {
          snapshotCallCount++
          return snapshotCallCount === 1 ? priorSnapshotChain : insertChain
        }
        return makeChain()
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toMatchObject({ success: true, snapshotId: 'snap-1', version: 1 })
  })

  test('computes next version as max + 1 when prior snapshots exist', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: 'Q1 2026' },
        error: null,
      }),
    })
    const draftChain = makeChain({
      single: async () => ({
        data: { data: {}, narrative: { cover_subtitle: 'hi' } },
        error: null,
      }),
    })
    const priorSnapshotChain = makeChain({
      maybeSingle: async () => ({ data: { version: 4 }, error: null }),
    })
    const insertChain = makeChain({
      single: async () => ({ data: { id: 'snap-5' }, error: null }),
    })
    const updateChain = makeChain()

    let snapshotCallCount = 0
    let reviewCallCount = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'marketing_reviews') {
          reviewCallCount++
          return reviewCallCount === 1 ? reviewChain : updateChain
        }
        if (table === 'marketing_review_drafts') return draftChain
        if (table === 'marketing_review_snapshots') {
          snapshotCallCount++
          return snapshotCallCount === 1 ? priorSnapshotChain : insertChain
        }
        return makeChain()
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toMatchObject({ success: true, version: 5 })
  })
})
