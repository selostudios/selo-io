import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HiddenSlideOverlay } from '@/components/reviews/review-deck/hidden-slide-overlay'

describe('HiddenSlideOverlay', () => {
  test('renders children with reduced opacity and a "Hidden" badge', () => {
    render(
      <HiddenSlideOverlay>
        <div data-testid="child">Slide</div>
      </HiddenSlideOverlay>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.getByTestId('hidden-slide-overlay')).toHaveClass('opacity-40')
  })
})
