import { describe, test, expect, vi } from 'vitest'

import { insertMemoVersion } from '@/lib/reviews/narrative/memo-history'

function makeSupabaseMock(options: {
  priorMemo?: string | null
  priorError?: { message: string } | null
  insertError?: { message: string } | null
}) {
  const insertFn = vi.fn(async () => ({ error: options.insertError ?? null }))

  const maybeSingle = vi.fn(async () => {
    if (options.priorError) return { data: null, error: options.priorError }
    if (options.priorMemo === null || options.priorMemo === undefined) {
      return { data: null, error: null }
    }
    return { data: { memo: options.priorMemo }, error: null }
  })

  const from = vi.fn(() => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle,
      insert: insertFn,
    }
    return chain
  })

  return { from, insertFn, maybeSingle }
}

describe('insertMemoVersion', () => {
  test('inserts a new version row when no prior version exists', async () => {
    const mock = makeSupabaseMock({ priorMemo: null })

    const result = await insertMemoVersion({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: { from: mock.from } as any,
      organizationId: 'org-1',
      snapshotId: 'snap-1',
      memo: 'New memo body.',
      rationale: 'Author prefers plain numbers.',
      source: 'auto',
      createdBy: null,
    })

    expect(result).toEqual({ inserted: true })
    expect(mock.insertFn).toHaveBeenCalledTimes(1)
    expect(mock.insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        snapshot_id: 'snap-1',
        memo: 'New memo body.',
        rationale: 'Author prefers plain numbers.',
        source: 'auto',
        created_by: null,
      })
    )
  })

  test('skips insert when the prior memo matches the new memo exactly', async () => {
    const mock = makeSupabaseMock({ priorMemo: 'Same memo body.' })

    const result = await insertMemoVersion({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: { from: mock.from } as any,
      organizationId: 'org-1',
      snapshotId: null,
      memo: 'Same memo body.',
      rationale: 'Rationale.',
      source: 'auto',
      createdBy: null,
    })

    expect(result).toEqual({ inserted: false, reason: 'duplicate' })
    expect(mock.insertFn).not.toHaveBeenCalled()
  })

  test('surfaces the DB error when the insert fails', async () => {
    const mock = makeSupabaseMock({
      priorMemo: 'Old memo.',
      insertError: { message: 'boom' },
    })

    const result = await insertMemoVersion({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: { from: mock.from } as any,
      organizationId: 'org-1',
      snapshotId: 'snap-2',
      memo: 'New memo.',
      rationale: 'Updated rationale.',
      source: 'auto',
      createdBy: null,
    })

    expect(result).toEqual({ inserted: false, reason: 'error', error: 'boom' })
  })
})
