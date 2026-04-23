import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeChain } from '@/tests/helpers/supabase-mocks'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/cached', () => ({
  getAuthUser: vi.fn(),
  getUserRecord: vi.fn(),
}))

const runStyleMemoLearner = vi.fn()
vi.mock('@/lib/reviews/narrative/learn', () => ({
  runStyleMemoLearner: (...args: unknown[]) => runStyleMemoLearner(...args),
}))

const insertMemoVersion = vi.fn(async () => ({ inserted: true }))
vi.mock('@/lib/reviews/narrative/memo-history', () => ({
  insertMemoVersion: (...args: unknown[]) => insertMemoVersion(...args),
}))

import {
  saveStyleMemo,
  clearStyleMemo,
  regenerateStyleMemoFromLatestSnapshot,
} from '@/lib/reviews/narrative/style-memo-actions'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { revalidatePath } from 'next/cache'

describe('saveStyleMemo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertMemoVersion.mockResolvedValue({ inserted: true } as never)
  })

  test('rejects unauthenticated callers', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)

    const result = await saveStyleMemo('org-1', 'hello')

    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  test('rejects callers who are neither org admin nor internal', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'team_member',
      is_internal: false,
    } as never)

    const result = await saveStyleMemo('org-1', 'hello')

    expect(result).toEqual({ success: false, error: 'Insufficient permissions' })
  })

  test('truncates long memos to the 2000-char cap before upserting', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const upsertMock = vi.fn<(payload: Record<string, unknown>, options: unknown) => unknown>(
      async () => ({ error: null })
    )
    const supabase = {
      from: vi.fn(() => ({ upsert: upsertMock })),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const longMemo = 'x'.repeat(3000)
    const result = await saveStyleMemo('org-1', longMemo)

    expect(result).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [payload, options] = upsertMock.mock.calls[0]
    expect((payload.memo as string).length).toBeLessThanOrEqual(2000)
    expect(payload.source).toBe('manual')
    expect(payload.updated_by).toBe('user-1')
    expect(payload.organization_id).toBe('org-1')
    expect(options).toEqual({ onConflict: 'organization_id' })
  })

  test('revalidates the settings path after a successful save', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const upsertMock = vi.fn(async () => ({ error: null }))
    const supabase = { from: vi.fn(() => ({ upsert: upsertMock })) }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await saveStyleMemo('org-1', 'short memo')

    expect(result).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/org-1/reports/performance/settings')
  })

  test('inserts a manual version row after saving a new memo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const upsertMock = vi.fn(async () => ({ error: null }))
    const supabase = { from: vi.fn(() => ({ upsert: upsertMock })) }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const longMemo = 'y'.repeat(3000)
    const result = await saveStyleMemo('org-1', longMemo)

    expect(result).toEqual({ success: true })
    expect(insertMemoVersion).toHaveBeenCalledTimes(1)
    const call = insertMemoVersion.mock.calls[0][0] as {
      supabase: unknown
      organizationId: string
      snapshotId: string | null
      memo: string
      rationale: string | null
      source: string
      createdBy: string | null
    }
    expect(call.supabase).toBe(supabase)
    expect(call.organizationId).toBe('org-1')
    expect(call.snapshotId).toBeNull()
    expect(call.rationale).toBeNull()
    expect(call.source).toBe('manual')
    expect(call.createdBy).toBe('user-1')
    // Truncated memo is passed through — same value the upsert received.
    const [upsertPayload] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown]
    expect(call.memo).toBe(upsertPayload.memo)
    expect(call.memo.length).toBeLessThanOrEqual(2000)
  })

  test('returns success even when version-row insert fails (non-fatal)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const upsertMock = vi.fn(async () => ({ error: null }))
    const supabase = { from: vi.fn(() => ({ upsert: upsertMock })) }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    insertMemoVersion.mockResolvedValueOnce({
      inserted: false,
      reason: 'error',
      error: 'db exploded',
    } as never)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await saveStyleMemo('org-1', 'some memo')

      expect(result).toEqual({ success: true })
      expect(errorSpy).toHaveBeenCalled()
      const loggedPayload = errorSpy.mock.calls.find(
        ([, payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          (payload as { type?: string }).type === 'version_insert_error'
      )
      expect(loggedPayload).toBeDefined()
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('clearStyleMemo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertMemoVersion.mockResolvedValue({ inserted: true } as never)
  })

  test('upserts an empty string with manual source', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const upsertMock = vi.fn<(payload: Record<string, unknown>, options: unknown) => unknown>(
      async () => ({ error: null })
    )
    const supabase = { from: vi.fn(() => ({ upsert: upsertMock })) }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await clearStyleMemo('org-1')

    expect(result).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [payload] = upsertMock.mock.calls[0]
    expect(payload.memo).toBe('')
    expect(payload.source).toBe('manual')
  })
})

describe('regenerateStyleMemoFromLatestSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runStyleMemoLearner.mockResolvedValue({ status: 'updated' })
  })

  test('loads latest snapshot + org and forwards to the learner', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const aiOriginals = {
      cover_subtitle: 'ai cover',
      ga_summary: 'ai ga',
      linkedin_insights: 'ai li',
      initiatives: 'ai init',
      takeaways: 'ai take',
      planning: 'ai plan',
    }
    const finalNarrative = { ...aiOriginals, ga_summary: 'author ga' }

    const snapshotRow = {
      id: 'snap-1',
      review_id: 'review-1',
      ai_originals: aiOriginals,
      narrative: finalNarrative,
      author_notes: 'a note',
    }

    const snapshotChain = makeChain({
      maybeSingle: async () => ({ data: snapshotRow, error: null }),
    })
    const orgChain = makeChain({
      single: async () => ({ data: { name: 'ACME' }, error: null }),
    })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'marketing_review_snapshots') return snapshotChain
        if (table === 'organizations') return orgChain
        return makeChain()
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await regenerateStyleMemoFromLatestSnapshot('org-1')

    expect(result).toEqual({ success: true })
    expect(runStyleMemoLearner).toHaveBeenCalledTimes(1)
    expect(runStyleMemoLearner).toHaveBeenCalledWith({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai: aiOriginals,
      finalNarrative,
      authorNotes: 'a note',
      snapshotId: 'snap-1',
      reviewId: 'review-1',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/org-1/reports/performance/settings')
  })

  test('returns an error without invoking the learner when no snapshot exists', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)

    const snapshotChain = makeChain({
      maybeSingle: async () => ({ data: null, error: null }),
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'marketing_review_snapshots') return snapshotChain
        return makeChain()
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await regenerateStyleMemoFromLatestSnapshot('org-1')

    expect(result).toEqual({ success: false, error: 'No published snapshot to learn from' })
    expect(runStyleMemoLearner).not.toHaveBeenCalled()
  })
})
