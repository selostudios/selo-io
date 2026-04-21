import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { BodySlide } from '@/components/reviews/review-deck/body-slide'

describe('BodySlide', () => {
  test('renders paragraph-only text as one <p> per paragraph', () => {
    const text = 'First paragraph of the summary.\nSecond paragraph continues the story.'

    const { container } = render(<BodySlide heading="Google Analytics" text={text} />)

    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toHaveTextContent('First paragraph of the summary.')
    expect(paragraphs[1]).toHaveTextContent('Second paragraph continues the story.')
    expect(container.querySelector('ul')).toBeNull()
  })

  test('renders dash-prefixed lines as a single <ul> with one <li> each', () => {
    const text = '- SEO traffic up 40%\n- LinkedIn engagement doubled\n- Email CTR improved'

    const { container } = render(<BodySlide heading="Takeaways" text={text} />)

    const lists = container.querySelectorAll('ul')
    expect(lists).toHaveLength(1)

    const items = within(lists[0]).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('SEO traffic up 40%')
    expect(items[1]).toHaveTextContent('LinkedIn engagement doubled')
    expect(items[2]).toHaveTextContent('Email CTR improved')
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  test('preserves order when paragraphs and bullet lines are interleaved', () => {
    const text = [
      'Great quarter overall.',
      '',
      '- SEO traffic up 40%',
      '- LinkedIn engagement doubled',
      '',
      'Momentum carried into March.',
    ].join('\n')

    const { container } = render(<BodySlide heading="Takeaways" text={text} />)

    // Query direct children in order (the narrative wrapper holds them).
    const narrative = container.querySelector('[data-testid="body-slide-content"]')
    expect(narrative).not.toBeNull()
    const nodes = Array.from(narrative!.children)

    expect(nodes).toHaveLength(3)
    expect(nodes[0].tagName).toBe('P')
    expect(nodes[0]).toHaveTextContent('Great quarter overall.')

    expect(nodes[1].tagName).toBe('UL')
    const items = within(nodes[1] as HTMLElement).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('SEO traffic up 40%')
    expect(items[1]).toHaveTextContent('LinkedIn engagement doubled')

    expect(nodes[2].tagName).toBe('P')
    expect(nodes[2]).toHaveTextContent('Momentum carried into March.')
  })

  test('renders placeholder for an empty string', () => {
    render(<BodySlide heading="Takeaways" text="" />)

    expect(screen.getByText('No narrative available for this section')).toBeInTheDocument()
  })

  test('renders placeholder for whitespace-only text', () => {
    render(<BodySlide heading="Takeaways" text={'   \n\t  \n  '} />)

    expect(screen.getByText('No narrative available for this section')).toBeInTheDocument()
  })
})
