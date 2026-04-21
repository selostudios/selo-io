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

import {
  checkReviewExists,
  deleteReview,
  publishReview,
  updateAuthorNotes,
} from '@/lib/reviews/actions'
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

describe('checkReviewExists', () => {
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
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn() } as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  test('rejects users who are neither org admins nor internal', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'team_member',
      is_internal: false,
    } as never)
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn() } as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' })
  })

  test('returns exists: false when no review exists for that org and quarter', async () => {
    const chain = makeChain({ maybeSingle: async () => ({ data: null, error: null }) })
    const supabase = { from: vi.fn(() => chain) }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({ exists: false })
    expect(chain.eq).toHaveBeenCalledWith('organization_id', 'org-1')
    expect(chain.eq).toHaveBeenCalledWith('quarter', '2026-Q2')
  })

  test('reports hasPublishedSnapshots as false when latest_snapshot_id is null', async () => {
    const chain = makeChain({
      maybeSingle: async () => ({
        data: { id: 'review-42', latest_snapshot_id: null },
        error: null,
      }),
    })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({
      exists: true,
      reviewId: 'review-42',
      hasPublishedSnapshots: false,
    })
  })

  test('reports hasPublishedSnapshots as true when latest_snapshot_id is set', async () => {
    const chain = makeChain({
      maybeSingle: async () => ({
        data: { id: 'review-42', latest_snapshot_id: 'snap-7' },
        error: null,
      }),
    })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({
      exists: true,
      reviewId: 'review-42',
      hasPublishedSnapshots: true,
    })
  })

  test('propagates the database error when the lookup fails', async () => {
    const chain = makeChain({
      maybeSingle: async () => ({ data: null, error: { message: 'boom' } }),
    })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({ success: false, error: 'boom' })
  })

  test('allows internal users to check any organization', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'different-org',
      role: 'developer',
      is_internal: true,
    } as never)
    const chain = makeChain({ maybeSingle: async () => ({ data: null, error: null }) })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await checkReviewExists('org-1', '2026-Q2')
    expect(result).toEqual({ exists: false })
  })
})

describe('deleteReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)
  })

  test('returns not-found when the review does not exist', async () => {
    const chain = makeChain({ maybeSingle: async () => ({ data: null, error: null }) })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await deleteReview('review-404')
    expect(result).toEqual({ success: false, error: 'Review not found' })
  })

  test('rejects non-admin non-internal users', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'team_member',
      is_internal: false,
    } as never)
    const chain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await deleteReview('review-1')
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' })
  })

  test('deletes the review and returns success when authorized', async () => {
    const deleteChain = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn(async () => ({ error: null })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(deleteChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await deleteReview('review-1')
    expect(result).toEqual({ success: true })
    expect(deleteChain.delete).toHaveBeenCalledOnce()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'review-1')
  })

  test('surfaces database errors during delete', async () => {
    const deleteChain = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn(async () => ({ error: { message: 'fk violation' } })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(deleteChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await deleteReview('review-1')
    expect(result).toEqual({ success: false, error: 'fk violation' })
  })

  test('allows internal users to delete reviews in any organization', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'different-org',
      role: 'developer',
      is_internal: true,
    } as never)
    const deleteChain = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn(async () => ({ error: null })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(deleteChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await deleteReview('review-1')
    expect(result).toEqual({ success: true })
  })
})

describe('updateAuthorNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)
  })

  test('returns not-found when the review does not exist', async () => {
    const chain = makeChain({ maybeSingle: async () => ({ data: null, error: null }) })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await updateAuthorNotes('review-404', 'some notes')
    expect(result).toEqual({ success: false, error: 'Review not found' })
  })

  test('rejects non-admin non-internal users', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'team_member',
      is_internal: false,
    } as never)
    const chain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => chain) } as never)

    const result = await updateAuthorNotes('review-1', 'some notes')
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' })
  })

  test('writes trimmed notes when content is non-empty', async () => {
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(async () => ({ error: null })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await updateAuthorNotes('review-1', '   big campaign last quarter   ')
    expect(result).toEqual({ success: true })
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ author_notes: 'big campaign last quarter' })
    )
  })

  test('stores null when notes are whitespace-only', async () => {
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(async () => ({ error: null })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await updateAuthorNotes('review-1', '    ')
    expect(result).toEqual({ success: true })
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ author_notes: null }))
  })

  test('surfaces database errors during update', async () => {
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(async () => ({ error: { message: 'disk full' } })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await updateAuthorNotes('review-1', 'hello')
    expect(result).toEqual({ success: false, error: 'disk full' })
  })

  test('allows internal users to update notes in any organization', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'different-org',
      role: 'developer',
      is_internal: true,
    } as never)
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(async () => ({ error: null })),
    }
    const lookupChain = makeChain({
      maybeSingle: async () => ({
        data: { organization_id: 'org-1', quarter: '2026-Q2' },
        error: null,
      }),
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain as never)
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as never)

    const result = await updateAuthorNotes('review-1', 'hello')
    expect(result).toEqual({ success: true })
  })
})
