import { describe, test, expect, vi } from 'vitest'
import { resolvePublisherNames } from '@/lib/reviews/publishers'

function makeSupabase(
  rows: Array<{ id: string; first_name: string | null; last_name: string | null }>
) {
  const inFn = vi.fn(async () => ({ data: rows, error: null }))
  const selectFn = vi.fn(() => ({ in: inFn }))
  const fromFn = vi.fn(() => ({ select: selectFn }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: fromFn, _selectFn: selectFn, _inFn: inFn } as any
}

describe('resolvePublisherNames', () => {
  test('returns a map keyed by user id with full names', async () => {
    const supabase = makeSupabase([
      { id: 'user-1', first_name: 'Jane', last_name: 'Doe' },
      { id: 'user-2', first_name: 'Ada', last_name: 'Lovelace' },
    ])

    const result = await resolvePublisherNames(supabase, ['user-1', 'user-2'])

    expect(result.get('user-1')).toBe('Jane Doe')
    expect(result.get('user-2')).toBe('Ada Lovelace')
  })

  test('combines first and last name, trimming extra whitespace', async () => {
    const supabase = makeSupabase([{ id: 'user-1', first_name: '  Jane  ', last_name: '  Doe  ' }])

    const result = await resolvePublisherNames(supabase, ['user-1'])

    expect(result.get('user-1')).toBe('Jane Doe')
  })

  test('falls back to just first name when last name is missing', async () => {
    const supabase = makeSupabase([
      { id: 'user-1', first_name: 'Cher', last_name: null },
      { id: 'user-2', first_name: null, last_name: 'Prince' },
    ])

    const result = await resolvePublisherNames(supabase, ['user-1', 'user-2'])

    expect(result.get('user-1')).toBe('Cher')
    expect(result.get('user-2')).toBe('Prince')
  })

  test('omits users whose first and last names are both empty or null', async () => {
    const supabase = makeSupabase([
      { id: 'user-1', first_name: null, last_name: null },
      { id: 'user-2', first_name: '', last_name: '   ' },
      { id: 'user-3', first_name: 'Real', last_name: 'Name' },
    ])

    const result = await resolvePublisherNames(supabase, ['user-1', 'user-2', 'user-3'])

    expect(result.has('user-1')).toBe(false)
    expect(result.has('user-2')).toBe(false)
    expect(result.get('user-3')).toBe('Real Name')
  })

  test('omits users not returned by the query (RLS-hidden or missing)', async () => {
    // Only user-1 comes back; user-2 was requested but missing.
    const supabase = makeSupabase([{ id: 'user-1', first_name: 'Jane', last_name: 'Doe' }])

    const result = await resolvePublisherNames(supabase, ['user-1', 'user-2'])

    expect(result.has('user-1')).toBe(true)
    expect(result.has('user-2')).toBe(false)
  })

  test('returns an empty map and skips the query when no ids are provided', async () => {
    const supabase = makeSupabase([])

    const result = await resolvePublisherNames(supabase, [])

    expect(result.size).toBe(0)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('deduplicates repeated ids and queries once', async () => {
    const supabase = makeSupabase([{ id: 'user-1', first_name: 'Jane', last_name: 'Doe' }])

    await resolvePublisherNames(supabase, ['user-1', 'user-1', 'user-1'])

    expect(supabase._inFn).toHaveBeenCalledTimes(1)
    // Verify the second argument is a deduped array (single id).
    expect(supabase._inFn.mock.calls[0][1]).toEqual(['user-1'])
  })

  test('filters out empty-string ids before querying', async () => {
    const supabase = makeSupabase([{ id: 'user-1', first_name: 'Jane', last_name: 'Doe' }])

    await resolvePublisherNames(supabase, ['user-1', ''])

    expect(supabase._inFn).toHaveBeenCalledTimes(1)
    expect(supabase._inFn.mock.calls[0][1]).toEqual(['user-1'])
  })
})
