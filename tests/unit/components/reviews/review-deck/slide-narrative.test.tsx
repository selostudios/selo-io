import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  EMPTY_NARRATIVE_PLACEHOLDER,
  SlideNarrative,
} from '@/components/reviews/review-deck/slide-narrative'

describe('SlideNarrative', () => {
  test('renders the empty placeholder when text is an empty string', () => {
    render(<SlideNarrative text="" testId="x" />)
    expect(screen.getByText(EMPTY_NARRATIVE_PLACEHOLDER)).toBeInTheDocument()
  })

  test('renders the empty placeholder when text is whitespace-only', () => {
    render(<SlideNarrative text={'   \n\t  \n  '} testId="x" />)
    expect(screen.getByText(EMPTY_NARRATIVE_PLACEHOLDER)).toBeInTheDocument()
  })

  test('tags the content wrapper with the provided testId', () => {
    render(<SlideNarrative text="Hello." testId="slide-foo-content" />)
    expect(screen.getByTestId('slide-foo-content')).toBeInTheDocument()
  })

  test('renders a paragraph for non-bullet text', () => {
    const { container } = render(<SlideNarrative text="Just a sentence." testId="x" />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]).toHaveTextContent('Just a sentence.')
  })

  test('collapses consecutive bullet lines into a single <ul>', () => {
    const text = '- First point\n- Second point\n- Third point'
    const { container } = render(<SlideNarrative text={text} testId="x" />)
    const lists = container.querySelectorAll('ul')
    expect(lists).toHaveLength(1)
    const items = within(lists[0]).getAllByRole('listitem')
    expect(items.map((i) => i.textContent)).toEqual(['First point', 'Second point', 'Third point'])
  })

  test('preserves order when paragraphs and bullets are interleaved', () => {
    const text = ['Lead-in paragraph.', '', '- bullet one', '- bullet two', '', 'Closing.'].join(
      '\n'
    )
    render(<SlideNarrative text={text} testId="content" />)
    const nodes = Array.from(screen.getByTestId('content').children)
    expect(nodes.map((n) => n.tagName)).toEqual(['P', 'UL', 'P'])
  })

  test('renders "Going well" and "To improve" as bold heading-style paragraphs', () => {
    const text = [
      'Going well',
      '- Sessions held steady.',
      '',
      'To improve',
      '- Bounce rate climbed.',
    ].join('\n')

    render(<SlideNarrative text={text} testId="content" />)

    const goingWell = screen.getByText('Going well')
    const toImprove = screen.getByText('To improve')
    expect(goingWell.tagName).toBe('P')
    expect(toImprove.tagName).toBe('P')
    expect(goingWell.className).toContain('font-semibold')
    expect(toImprove.className).toContain('font-semibold')
  })

  test('does not apply the heading treatment to ordinary paragraphs', () => {
    render(<SlideNarrative text="Closing thought." testId="content" />)
    const p = screen.getByText('Closing thought.')
    expect(p.className).not.toContain('font-semibold')
  })
})
