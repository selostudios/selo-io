import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/reviews/actions', () => ({
  setSlideVisibility: vi.fn(),
}))

vi.mock('@/components/ui/sonner', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

import { SlideThumbnailStrip } from '@/components/reviews/editor/slide-thumbnail-strip'

describe('SlideThumbnailStrip', () => {
  test('renders all seven slide thumbnails in registry order', () => {
    render(<SlideThumbnailStrip orgId="o1" reviewId="r1" hiddenSlides={[]} />)

    const cards = screen.getAllByTestId(/^slide-thumbnail-/)
    expect(cards).toHaveLength(7)
    expect(cards[0]).toHaveAttribute('data-testid', 'slide-thumbnail-cover')
    expect(cards[6]).toHaveAttribute('data-testid', 'slide-thumbnail-planning')
  })

  test('marks hidden slides with data-hidden=true', () => {
    render(<SlideThumbnailStrip orgId="o1" reviewId="r1" hiddenSlides={['ga_summary']} />)

    expect(screen.getByTestId('slide-thumbnail-ga_summary')).toHaveAttribute('data-hidden', 'true')
    expect(screen.getByTestId('slide-thumbnail-cover')).toHaveAttribute('data-hidden', 'false')
  })
})
