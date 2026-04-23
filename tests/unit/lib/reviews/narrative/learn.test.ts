import { describe, test, expect, vi, beforeEach } from 'vitest'

const generateObject = vi.fn()
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}))

const anthropicFactory = vi.fn((modelId: string) => `mock-model:${modelId}`)
const getAnthropicProvider = vi.fn(() => anthropicFactory)
vi.mock('@/lib/ai/provider', () => ({
  getAnthropicProvider: () => getAnthropicProvider(),
}))

const upsertMemo = vi.fn()
const versionInsert = vi.fn(async () => ({ error: null }))
const versionPriorMemo: { value: string | null } = { value: null }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'marketing_review_style_memo_versions') {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle: vi.fn(async () =>
            versionPriorMemo.value === null
              ? { data: null, error: null }
              : { data: { memo: versionPriorMemo.value }, error: null }
          ),
          insert: (payload: unknown) => versionInsert(payload),
        }
        return chain
      }
      return {
        upsert: (payload: unknown) => {
          upsertMemo(payload)
          return Promise.resolve({ error: null })
        },
      }
    },
  }),
}))

const loadStyleMemo = vi.fn()
vi.mock('@/lib/reviews/narrative/style-memo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reviews/narrative/style-memo')>(
    '@/lib/reviews/narrative/style-memo'
  )
  return {
    ...actual,
    loadStyleMemo: (...args: unknown[]) => loadStyleMemo(...args),
  }
})

import { runStyleMemoLearner } from '@/lib/reviews/narrative/learn'
import type { NarrativeBlocks } from '@/lib/reviews/types'

const ai: NarrativeBlocks = {
  cover_subtitle: 's',
  ga_summary: 'AI ga',
  linkedin_insights: 'AI li',
  initiatives: 'AI init',
  takeaways: 'AI take',
  planning: 'AI plan',
}

beforeEach(() => {
  generateObject.mockReset()
  upsertMemo.mockReset()
  loadStyleMemo.mockReset()
  versionInsert.mockReset()
  versionInsert.mockImplementation(async () => ({ error: null }))
  versionPriorMemo.value = null
})

describe('runStyleMemoLearner', () => {
  test('skips LLM + upsert when no edits and no author notes', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative: ai,
      authorNotes: null,
    })
    expect(result).toEqual({ status: 'skipped' })
    expect(generateObject).not.toHaveBeenCalled()
    expect(upsertMemo).not.toHaveBeenCalled()
  })

  test('calls the LLM and upserts when edits are present', async () => {
    loadStyleMemo.mockResolvedValueOnce('Existing memo.')
    generateObject.mockResolvedValueOnce({
      object: { memo: 'Updated memo body.', rationale: 'Noticed a preference.' },
    })
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })

    expect(result).toMatchObject({ status: 'updated', memo: 'Updated memo body.' })
    expect(generateObject).toHaveBeenCalledTimes(1)
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('AUTHOR EDITS'),
      })
    )
    expect(upsertMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        memo: 'Updated memo body.',
        source: 'auto',
        updated_by: null,
      })
    )
  })

  test('returns rationale alongside memo on successful update', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateObject.mockResolvedValueOnce({
      object: {
        memo: 'Updated memo body.',
        rationale: 'Noticed author prefers plain numbers; reinforced that.',
      },
    })
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })

    expect(result).toMatchObject({
      status: 'updated',
      rationale: expect.any(String),
    })
    if (result.status === 'updated') {
      expect(result.rationale.length).toBeGreaterThan(0)
    }
  })

  test('truncates when the LLM returns a memo above the cap', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    const longMemo = 'x'.repeat(3000)
    generateObject.mockResolvedValueOnce({
      object: { memo: longMemo, rationale: 'Rationale.' },
    })
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })

    const payload = upsertMemo.mock.calls[0][0] as { memo: string }
    expect(payload.memo.length).toBeLessThanOrEqual(2000)
  })

  test('returns failure status and does not upsert when the LLM returns empty memo', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateObject.mockResolvedValueOnce({
      object: { memo: '   ', rationale: 'Rationale.' },
    })
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })
    expect(result).toEqual({ status: 'failed', reason: 'empty_response' })
    expect(upsertMemo).not.toHaveBeenCalled()
  })

  test('inserts a version row with source=auto, snapshotId, memo, and rationale after a successful upsert', async () => {
    loadStyleMemo.mockResolvedValueOnce('Existing memo.')
    generateObject.mockResolvedValueOnce({
      object: {
        memo: 'Updated memo body.',
        rationale: 'Author prefers concise bullets.',
      },
    })
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
      snapshotId: 'snap-9',
    })

    expect(result).toMatchObject({ status: 'updated' })
    expect(versionInsert).toHaveBeenCalledTimes(1)
    expect(versionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        snapshot_id: 'snap-9',
        memo: 'Updated memo body.',
        rationale: 'Author prefers concise bullets.',
        source: 'auto',
        created_by: null,
      })
    )
  })

  test('does not log an error and stays updated when the version helper reports a duplicate', async () => {
    loadStyleMemo.mockResolvedValueOnce('Existing memo.')
    generateObject.mockResolvedValueOnce({
      object: { memo: 'Updated memo body.', rationale: 'Rationale.' },
    })
    // Prior version row has the same memo text → helper short-circuits with
    // { inserted: false, reason: 'duplicate' } and never calls .insert().
    versionPriorMemo.value = 'Updated memo body.'
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
      snapshotId: 'snap-9',
    })

    expect(result).toMatchObject({
      status: 'updated',
      memo: 'Updated memo body.',
      rationale: 'Rationale.',
    })
    expect(versionInsert).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  test('still returns updated and logs version_insert_error when the version insert fails', async () => {
    loadStyleMemo.mockResolvedValueOnce('Existing memo.')
    generateObject.mockResolvedValueOnce({
      object: { memo: 'Updated memo body.', rationale: 'Rationale.' },
    })
    versionInsert.mockImplementationOnce(async () => ({ error: { message: 'boom' } }))
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
      snapshotId: 'snap-9',
    })

    expect(result).toMatchObject({
      status: 'updated',
      memo: 'Updated memo body.',
      rationale: 'Rationale.',
    })
    expect(errorSpy).toHaveBeenCalledWith(
      '[Style Memo Error]',
      expect.objectContaining({
        type: 'version_insert_error',
        orgId: 'org-1',
        snapshotId: 'snap-9',
        error: 'boom',
      })
    )
    errorSpy.mockRestore()
  })

  test('returns failure status when the LLM throws', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateObject.mockRejectedValueOnce(new Error('anthropic down'))
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
      snapshotId: 'snap-42',
    })
    expect(result).toEqual({ status: 'failed', reason: 'llm_error' })
    expect(upsertMemo).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      '[Style Memo Error]',
      expect.objectContaining({ type: 'llm_error', snapshotId: 'snap-42' })
    )
    errorSpy.mockRestore()
  })
})
