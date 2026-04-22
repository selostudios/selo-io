import { describe, test, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateText(...args),
}))

const anthropicFactory = vi.fn((modelId: string) => `mock-model:${modelId}`)
const getAnthropicProvider = vi.fn(() => anthropicFactory)
vi.mock('@/lib/ai/provider', () => ({
  getAnthropicProvider: () => getAnthropicProvider(),
}))

const upsertMemo = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      upsert: (payload: unknown) => {
        upsertMemo(payload)
        return Promise.resolve({ error: null })
      },
    }),
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
  generateText.mockReset()
  upsertMemo.mockReset()
  loadStyleMemo.mockReset()
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
    expect(generateText).not.toHaveBeenCalled()
    expect(upsertMemo).not.toHaveBeenCalled()
  })

  test('calls the LLM and upserts when edits are present', async () => {
    loadStyleMemo.mockResolvedValueOnce('Existing memo.')
    generateText.mockResolvedValueOnce({ text: 'Updated memo body.' })
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })

    expect(result).toEqual({ status: 'updated' })
    expect(generateText).toHaveBeenCalledTimes(1)
    expect(upsertMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        memo: 'Updated memo body.',
        source: 'auto',
        updated_by: null,
      })
    )
  })

  test('truncates when the LLM returns a memo above the cap', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    const longMemo = 'x'.repeat(3000)
    generateText.mockResolvedValueOnce({ text: longMemo })
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

  test('returns failure status and does not upsert when the LLM returns empty text', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateText.mockResolvedValueOnce({ text: '   ' })
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

  test('returns failure status when the LLM throws', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateText.mockRejectedValueOnce(new Error('anthropic down'))
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })
    expect(result).toEqual({ status: 'failed', reason: 'llm_error' })
    expect(upsertMemo).not.toHaveBeenCalled()
  })
})
