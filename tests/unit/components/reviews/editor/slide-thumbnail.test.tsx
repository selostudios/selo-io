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
import { HiddenSlidesProvider } from '@/components/reviews/editor/hidden-slides-provider'
import type { SlideKey } from '@/lib/reviews/slides/registry'

function renderThumbnail(slideKey: SlideKey, initialHidden: SlideKey[] = []) {
  return render(
    <HiddenSlidesProvider reviewId="r1" initialHidden={initialHidden}>
      <SlideThumbnail orgId="o1" reviewId="r1" slideKey={slideKey} />
    </HiddenSlidesProvider>
  )
}

describe('SlideThumbnail', () => {
  test('renders the slide label', () => {
    renderThumbnail('ga_summary')

    expect(screen.getByText('Google Analytics')).toBeInTheDocument()
  })

  test('links to the slide editor route', () => {
    renderThumbnail('ga_summary')

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/o1/reports/performance/r1/slides/ga_summary'
    )
  })

  test('dims the card when the slide is hidden in context', () => {
    renderThumbnail('ga_summary', ['ga_summary'])

    expect(screen.getByTestId('slide-thumbnail-ga_summary')).toHaveClass('opacity-50')
  })

  test('renders the visibility toggle for hideable slides', () => {
    renderThumbnail('ga_summary')

    expect(screen.getByTestId('visibility-toggle-ga_summary')).toBeInTheDocument()
    expect(screen.getByTestId('visibility-switch-ga_summary')).toBeInTheDocument()
  })

  test('does not render any toggle for the cover slide', () => {
    renderThumbnail('cover')

    expect(screen.queryByTestId('visibility-toggle-cover')).toBeNull()
    expect(within(screen.getByTestId('slide-thumbnail-cover')).queryByRole('switch')).toBeNull()
  })
})
