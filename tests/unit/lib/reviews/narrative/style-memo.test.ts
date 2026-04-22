import { describe, test, expect, vi, beforeEach } from 'vitest'
import { loadStyleMemo, MAX_MEMO_CHARS, truncateMemo } from '@/lib/reviews/narrative/style-memo'

const maybeSingle = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}))

describe('loadStyleMemo', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
  })

  test('returns empty string when no row exists', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await loadStyleMemo('org-1')).toBe('')
  })

  test('returns empty string when the query errors', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await loadStyleMemo('org-1')).toBe('')
  })

  test('returns the memo field when present', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { memo: 'Be concise.' }, error: null })
    expect(await loadStyleMemo('org-1')).toBe('Be concise.')
  })

  test('returns empty string when memo column is null', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { memo: null }, error: null })
    expect(await loadStyleMemo('org-1')).toBe('')
  })
})

describe('truncateMemo', () => {
  test('returns input unchanged when under the cap', () => {
    expect(truncateMemo('short')).toBe('short')
  })

  test('truncates at the last paragraph break before the cap', () => {
    const prefix = 'para one.\n\n' + 'a'.repeat(MAX_MEMO_CHARS - 20)
    const text = prefix + '\n\npara three that overflows.'
    const result = truncateMemo(text)
    expect(result.length).toBeLessThanOrEqual(MAX_MEMO_CHARS)
    expect(result.endsWith('\n\n')).toBe(false)
  })

  test('hard-truncates when no paragraph break exists before the cap', () => {
    const text = 'x'.repeat(MAX_MEMO_CHARS + 500)
    const result = truncateMemo(text)
    expect(result.length).toBe(MAX_MEMO_CHARS)
  })
})
