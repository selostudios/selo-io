import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/reviews/actions', () => ({
  setSlideVisibility: vi.fn(),
}))

vi.mock('@/components/ui/sonner', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

import { SlideThumbnail } from '@/components/reviews/editor/slide-thumbnail'

describe('SlideThumbnail', () => {
  test('renders the slide label', () => {
    render(
      <SlideThumbnail orgId="o1" reviewId="r1" slideKey="ga_summary" hidden={false} />
    )

    expect(screen.getByText('Google Analytics')).toBeInTheDocument()
  })

  test('links to the slide editor route', () => {
    render(
      <SlideThumbnail orgId="o1" reviewId="r1" slideKey="ga_summary" hidden={false} />
    )

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/o1/reports/performance/r1/slides/ga_summary'
    )
  })

  test('dims the card when hidden is true', () => {
    render(
      <SlideThumbnail orgId="o1" reviewId="r1" slideKey="ga_summary" hidden={true} />
    )

    expect(screen.getByTestId('slide-thumbnail-ga_summary')).toHaveClass('opacity-50')
  })

  test('renders the HideSlideToggle button alongside the link for hideable slides and an inert dash for the cover', () => {
    const { rerender } = render(
      <SlideThumbnail orgId="o1" reviewId="r1" slideKey="ga_summary" hidden={false} />
    )

    const hideableToggle = screen.getByTestId('hide-slide-toggle-ga_summary')
    expect(hideableToggle).toBeInTheDocument()
    expect(hideableToggle.tagName).toBe('BUTTON')

    rerender(
      <SlideThumbnail orgId="o1" reviewId="r1" slideKey="cover" hidden={false} />
    )

    const coverToggle = screen.getByTestId('hide-slide-toggle-cover')
    expect(coverToggle).toBeInTheDocument()
    expect(coverToggle.tagName).not.toBe('BUTTON')
    expect(
      within(screen.getByTestId('slide-thumbnail-cover')).queryByRole('button')
    ).toBeNull()
  })
})
