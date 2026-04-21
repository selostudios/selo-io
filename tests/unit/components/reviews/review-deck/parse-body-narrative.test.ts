import { describe, test, expect } from 'vitest'
import { parseBodyNarrative } from '@/components/reviews/review-deck/parse-body-narrative'

describe('parseBodyNarrative', () => {
  test('returns a single list node for a one-bullet block', () => {
    const result = parseBodyNarrative('- Only one bullet')

    expect(result).toEqual([{ kind: 'list', content: ['Only one bullet'] }])
  })

  test('splits a mixed paragraph + bullet list into two nodes preserving order', () => {
    const result = parseBodyNarrative('Intro paragraph\n- Bullet one\n- Bullet two')

    expect(result).toEqual([
      { kind: 'paragraph', content: 'Intro paragraph' },
      { kind: 'list', content: ['Bullet one', 'Bullet two'] },
    ])
  })

  test('renders a "Going well / To improve" two-section narrative as four nodes', () => {
    const text = 'Going well\n- Sessions up\n- Users up\n\nTo improve\n- Bounce rate\n- Engagement'

    const result = parseBodyNarrative(text)

    expect(result).toEqual([
      { kind: 'paragraph', content: 'Going well' },
      { kind: 'list', content: ['Sessions up', 'Users up'] },
      { kind: 'paragraph', content: 'To improve' },
      { kind: 'list', content: ['Bounce rate', 'Engagement'] },
    ])
  })

  test('ignores trailing and whitespace-only lines', () => {
    const result = parseBodyNarrative('Para one\n   \n\t  \n')

    expect(result).toEqual([{ kind: 'paragraph', content: 'Para one' }])
  })

  test('returns an empty array for an empty string', () => {
    const result = parseBodyNarrative('')

    expect(result).toEqual([])
  })
})
