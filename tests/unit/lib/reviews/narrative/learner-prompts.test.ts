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
  slideNotes: [],
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
      diff: { changedBlocks: [], authorNotes: 'Q1 always dips.', slideNotes: [] },
    })
    expect(prompt.toLowerCase()).toContain('no edits this quarter')
  })

  test('labels absent author notes so the LLM does not infer missing data', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'ACME',
      currentMemo: '',
      diff: { changedBlocks: diff.changedBlocks, authorNotes: null, slideNotes: [] },
    })
    expect(prompt).toContain('AUTHOR NOTES FOR THIS QUARTER\n(none)')
  })

  test('prompt instructs the model to emit a rationale sentence', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'Acme',
      currentMemo: '',
      diff: { changedBlocks: [], authorNotes: null, slideNotes: [] },
    })
    expect(prompt).toMatch(/one-sentence rationale/i)
    expect(prompt).toMatch(/past-tense/i)
  })

  test('prompt requests structured memo + rationale fields', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'Acme',
      currentMemo: '',
      diff: { changedBlocks: [], authorNotes: null, slideNotes: [] },
    })
    expect(prompt).toMatch(/memo/)
    expect(prompt).toMatch(/rationale/)
  })

  test('labels absent slide notes so the LLM does not invent any', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'Acme',
      currentMemo: '',
      diff: { changedBlocks: [], authorNotes: null, slideNotes: [] },
    })
    expect(prompt).toContain('PER-SLIDE AUTHOR NOTES\n(none)')
  })

  test('includes per-slide notes keyed by block when present', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'Acme',
      currentMemo: '',
      diff: {
        changedBlocks: [],
        authorNotes: null,
        slideNotes: [
          { key: 'ga_summary', note: 'Stop using marketing jargon.' },
          { key: 'planning', note: 'Lean into experimentation language.' },
        ],
      },
    })
    expect(prompt).toContain('### ga_summary')
    expect(prompt).toContain('Stop using marketing jargon.')
    expect(prompt).toContain('### planning')
    expect(prompt).toContain('Lean into experimentation language.')
  })
})
