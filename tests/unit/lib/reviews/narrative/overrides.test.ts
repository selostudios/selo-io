import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { filterPromptOverrides, loadPromptOverrides } from '@/lib/reviews/narrative/overrides'
import { createServiceClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

function mockQueryResult(result: { data: unknown; error: unknown }) {
  ;(createServiceClient as unknown as Mock).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  })
}

describe('filterPromptOverrides', () => {
  test('keeps only known narrative block keys', () => {
    const result = filterPromptOverrides({
      cover_subtitle: 'custom cover',
      ga_summary: 'custom ga',
      unknown_block: 'drop me',
      random: 'nope',
    })
    expect(result).toEqual({
      cover_subtitle: 'custom cover',
      ga_summary: 'custom ga',
    })
  })

  test('drops non-string values', () => {
    const result = filterPromptOverrides({
      cover_subtitle: 123,
      ga_summary: null,
      initiatives: 'real override',
    })
    expect(result).toEqual({ initiatives: 'real override' })
  })

  test('drops empty-string values so they fall back to defaults', () => {
    const result = filterPromptOverrides({
      cover_subtitle: '',
      planning: 'actual planning prompt',
    })
    expect(result).toEqual({ planning: 'actual planning prompt' })
  })

  test('returns an empty object when given non-object input', () => {
    expect(filterPromptOverrides(null)).toEqual({})
    expect(filterPromptOverrides(undefined)).toEqual({})
    expect(filterPromptOverrides([1, 2, 3])).toEqual({})
    expect(filterPromptOverrides('string')).toEqual({})
  })
})

describe('loadPromptOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns an empty object when no row exists for the organization', async () => {
    mockQueryResult({ data: null, error: null })
    const result = await loadPromptOverrides('org-1')
    expect(result).toEqual({})
  })

  test('returns only the persisted keys', async () => {
    mockQueryResult({
      data: { prompts: { cover_subtitle: 'custom', takeaways: 'custom takeaways' } },
      error: null,
    })
    const result = await loadPromptOverrides('org-1')
    expect(result).toEqual({
      cover_subtitle: 'custom',
      takeaways: 'custom takeaways',
    })
  })

  test('drops unknown keys from the stored JSONB', async () => {
    mockQueryResult({
      data: { prompts: { cover_subtitle: 'ok', legacy_block: 'ignored' } },
      error: null,
    })
    const result = await loadPromptOverrides('org-1')
    expect(result).toEqual({ cover_subtitle: 'ok' })
  })

  test('returns an empty object when the query errors', async () => {
    mockQueryResult({ data: null, error: { message: 'db down' } })
    const result = await loadPromptOverrides('org-1')
    expect(result).toEqual({})
  })
})
