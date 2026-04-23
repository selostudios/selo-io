import { describe, test, expect } from 'vitest'
import {
  learnerOutputSchema,
  truncateRationale,
  RATIONALE_MAX_CHARS,
} from '@/lib/reviews/narrative/memo-history-types'

describe('learnerOutputSchema', () => {
  test('accepts well-formed learner output', () => {
    const result = learnerOutputSchema.safeParse({ memo: 'A', rationale: 'B' })
    expect(result.success).toBe(true)
  })

  test('rejects missing rationale', () => {
    const result = learnerOutputSchema.safeParse({ memo: 'A' })
    expect(result.success).toBe(false)
  })

  test('rejects non-string fields', () => {
    const result = learnerOutputSchema.safeParse({ memo: 1, rationale: 'B' })
    expect(result.success).toBe(false)
  })
})

describe('truncateRationale', () => {
  test('leaves short rationales untouched', () => {
    expect(truncateRationale('Noticed author prefers plain numbers.')).toBe(
      'Noticed author prefers plain numbers.'
    )
  })

  test('trims leading and trailing whitespace', () => {
    expect(truncateRationale('   hello   ')).toBe('hello')
  })

  test('truncates at RATIONALE_MAX_CHARS with an ellipsis', () => {
    const input = 'x'.repeat(RATIONALE_MAX_CHARS + 50)
    const result = truncateRationale(input)
    expect(result.length).toBe(RATIONALE_MAX_CHARS)
    expect(result.endsWith('…')).toBe(true)
  })
})
