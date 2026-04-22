import { describe, test, expect } from 'vitest'
import { buildLearnerPrompt } from '@/lib/reviews/narrative/learner-prompts'
import type { LearnerDiff } from '@/lib/reviews/narrative/style-memo'

const diff: LearnerDiff = {
  changedBlocks: [
    {
      key: 'ga_summary',
      aiText: 'Sessions grew 18%.',
      finalText: 'Sessions grew 18% — organic search doing the heavy lifting.',
    },
  ],
  authorNotes: 'Q1 always dips.',
}

describe('buildLearnerPrompt', () => {
  test('includes the organization name', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toContain('ACME')
  })

  test('includes the current memo when non-empty', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'ACME',
      currentMemo: 'Existing preference: concise bullets.',
      diff,
    })
    expect(prompt).toContain('Existing preference: concise bullets.')
  })

  test('labels the empty-memo case explicitly so the LLM knows to bootstrap', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt.toLowerCase()).toContain('no existing memo')
  })

  test('includes each changed block with AI draft and author final labeled', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toContain('ga_summary')
    expect(prompt).toContain('Sessions grew 18%.')
    expect(prompt).toContain('organic search doing the heavy lifting')
  })

  test('includes author notes when present', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toContain('Q1 always dips.')
  })

  test('notes the 500-word cap so the LLM self-limits', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toMatch(/500\s+word/i)
  })

  test('acknowledges when the author accepted the AI draft unchanged', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'ACME',
      currentMemo: '',
      diff: { changedBlocks: [], authorNotes: 'Q1 always dips.' },
    })
    expect(prompt.toLowerCase()).toContain('no edits this quarter')
  })

  test('labels absent author notes so the LLM does not infer missing data', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'ACME',
      currentMemo: '',
      diff: { changedBlocks: diff.changedBlocks, authorNotes: null },
    })
    expect(prompt).toContain('AUTHOR NOTES FOR THIS QUARTER\n(none)')
  })
})
