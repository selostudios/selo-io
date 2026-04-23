import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  buildLearnerDiff,
  loadStyleMemo,
  MAX_MEMO_CHARS,
  truncateMemo,
} from '@/lib/reviews/narrative/style-memo'
import type { NarrativeBlocks } from '@/lib/reviews/types'

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

describe('buildLearnerDiff', () => {
  const ai: NarrativeBlocks = {
    cover_subtitle: 'AI subtitle',
    ga_summary: 'AI ga summary',
    linkedin_insights: 'AI linkedin',
    initiatives: 'AI initiatives',
    takeaways: 'AI takeaways',
    planning: 'AI planning',
  }
  const finalNarrative: NarrativeBlocks = {
    ...ai,
    ga_summary: 'Author ga summary — punchier.',
    planning: 'Author planning.',
  }

  test('returns null when every block is unchanged and author notes are empty', () => {
    expect(buildLearnerDiff({ ai, finalNarrative: ai, authorNotes: null })).toBeNull()
  })

  test('returns null when every block is unchanged and notes are whitespace', () => {
    expect(buildLearnerDiff({ ai, finalNarrative: ai, authorNotes: '   \n ' })).toBeNull()
  })

  test('emits only the changed blocks when some differ', () => {
    const diff = buildLearnerDiff({ ai, finalNarrative, authorNotes: null })
    expect(diff).not.toBeNull()
    expect(diff!.changedBlocks.map((b) => b.key)).toEqual(['ga_summary', 'planning'])
    expect(diff!.changedBlocks[0]).toMatchObject({
      key: 'ga_summary',
      aiText: 'AI ga summary',
      finalText: 'Author ga summary — punchier.',
    })
  })

  test('emits the diff when blocks are unchanged but author notes are present', () => {
    const diff = buildLearnerDiff({
      ai,
      finalNarrative: ai,
      authorNotes: 'Q1 is always slow.',
    })
    expect(diff).not.toBeNull()
    expect(diff!.changedBlocks).toEqual([])
    expect(diff!.authorNotes).toBe('Q1 is always slow.')
  })

  test('treats missing AI or final values as empty strings for comparison', () => {
    const partialAi = { ...ai, ga_summary: '' }
    const partialFinal = { ...ai, ga_summary: 'Author wrote from scratch.' }
    const diff = buildLearnerDiff({
      ai: partialAi,
      finalNarrative: partialFinal,
      authorNotes: null,
    })
    expect(diff!.changedBlocks[0]).toMatchObject({
      aiText: '',
      finalText: 'Author wrote from scratch.',
    })
  })
})
