import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('next/server', () => ({
  after: (callback: () => Promise<void> | void) => {
    // Invoke synchronously so tests can observe side effects.
    // Fire-and-forget — swallow errors like real after() does.
    Promise.resolve(callback()).catch(() => {})
  },
}))

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

const runStyleMemoLearner = vi.fn()
vi.mock('@/lib/reviews/narrative/learn', () => ({
  runStyleMemoLearner: (...args: unknown[]) => runStyleMemoLearner(...args),
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

const reviewRow = {
  organization_id: 'org-1',
  quarter: 'Q1 2026',
  organizations: { name: 'ACME' },
}

function setupHappyPathSupabase(options: {
  draftData: {
    data: unknown
    narrative: unknown
    author_notes: unknown
    ai_originals: unknown
  }
}) {
  const reviewChain = makeChain({
    maybeSingle: async () => ({ data: reviewRow, error: null }),
  })
  const draftChain = makeChain({
    single: async () => ({ data: options.draftData, error: null }),
  })
  const priorSnapshotChain = makeChain({
    maybeSingle: async () => ({ data: null, error: null }),
  })

  const insertMock = vi.fn<(payload: Record<string, unknown>) => unknown>()
  const insertChain: Record<string, unknown> = {
    insert: insertMock,
    select: vi.fn(() => insertChain),
    single: vi.fn(async () => ({ data: { id: 'snap-1' }, error: null })),
  }
  insertMock.mockImplementation(() => insertChain)

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
  return { insertMock }
}

describe('publishReview — ai_originals forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)
    runStyleMemoLearner.mockResolvedValue({ status: 'updated' })
  })

  test('freezes ai_originals from draft onto the published snapshot', async () => {
    const aiOriginals = {
      cover_subtitle: 'ai cover',
      ga_summary: 'ai ga',
      linkedin_insights: 'ai linkedin',
      initiatives: 'ai initiatives',
      takeaways: 'ai takeaways',
      planning: 'ai planning',
    }

    const { insertMock } = setupHappyPathSupabase({
      draftData: {
        data: { ga: {} },
        narrative: { cover_subtitle: 'edited cover' },
        author_notes: 'a note',
        ai_originals: aiOriginals,
      },
    })

    const result = await publishReview('review-1')

    expect(result).toMatchObject({ success: true, snapshotId: 'snap-1' })
    expect(insertMock).toHaveBeenCalledTimes(1)
    const insertPayload = insertMock.mock.calls[0][0]
    expect(insertPayload.ai_originals).toEqual(aiOriginals)
  })

  test('writes ai_originals as null when the draft has no ai_originals recorded', async () => {
    const { insertMock } = setupHappyPathSupabase({
      draftData: {
        data: { ga: {} },
        narrative: { cover_subtitle: 'edited cover' },
        author_notes: null,
        ai_originals: null,
      },
    })

    const result = await publishReview('review-1')

    expect(result).toMatchObject({ success: true, snapshotId: 'snap-1' })
    expect(insertMock).toHaveBeenCalledTimes(1)
    const insertPayload = insertMock.mock.calls[0][0]
    expect(insertPayload.ai_originals).toBeNull()
  })
})

describe('publishReview — style memo learner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)
    runStyleMemoLearner.mockResolvedValue({ status: 'updated' })
  })

  test('fires the learner after a successful publish', async () => {
    const aiOriginals = {
      cover_subtitle: 'ai cover',
      ga_summary: 'ai ga',
      linkedin_insights: 'ai linkedin',
      initiatives: 'ai initiatives',
      takeaways: 'ai takeaways',
      planning: 'ai planning',
    }
    const finalNarrative = { ...aiOriginals, ga_summary: 'edited by author' }

    setupHappyPathSupabase({
      draftData: {
        data: { ga: {} },
        narrative: finalNarrative,
        author_notes: 'author note',
        ai_originals: aiOriginals,
      },
    })

    const result = await publishReview('review-1')

    expect(result).toMatchObject({ success: true, snapshotId: 'snap-1', version: 1 })

    // Flush microtasks so the fire-and-forget after() callback resolves.
    await Promise.resolve()
    await Promise.resolve()

    expect(runStyleMemoLearner).toHaveBeenCalledTimes(1)
    expect(runStyleMemoLearner).toHaveBeenCalledWith({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai: aiOriginals,
      finalNarrative,
      authorNotes: 'author note',
      slideNotes: {},
      snapshotId: 'snap-1',
      reviewId: 'review-1',
    })
  })

  test('returns success even when the learner returns a failed status', async () => {
    runStyleMemoLearner.mockResolvedValueOnce({ status: 'failed', reason: 'llm_error' })

    setupHappyPathSupabase({
      draftData: {
        data: { ga: {} },
        narrative: { cover_subtitle: 'edited cover' },
        author_notes: null,
        ai_originals: null,
      },
    })

    const result = await publishReview('review-1')

    expect(result).toEqual({ success: true, snapshotId: 'snap-1', version: 1 })
  })

  test('returns success even when the learner throws', async () => {
    runStyleMemoLearner.mockRejectedValueOnce(new Error('boom'))

    setupHappyPathSupabase({
      draftData: {
        data: { ga: {} },
        narrative: { cover_subtitle: 'edited cover' },
        author_notes: null,
        ai_originals: null,
      },
    })

    const result = await publishReview('review-1')

    expect(result).toEqual({ success: true, snapshotId: 'snap-1', version: 1 })
  })
})
