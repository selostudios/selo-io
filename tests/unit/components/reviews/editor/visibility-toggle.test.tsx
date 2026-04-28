import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/reviews/actions', () => ({
  setSlideVisibility: vi.fn(),
}))

vi.mock('@/components/ui/sonner', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

import { VisibilityToggle } from '@/components/reviews/editor/visibility-toggle'
import { HiddenSlidesProvider } from '@/components/reviews/editor/hidden-slides-provider'
import type { SlideKey } from '@/lib/reviews/slides/registry'
import { setSlideVisibility } from '@/lib/reviews/actions'

function renderToggle(slideKey: SlideKey, initialHidden: SlideKey[] = []) {
  return render(
    <HiddenSlidesProvider reviewId="r1" initialHidden={initialHidden}>
      <VisibilityToggle slideKey={slideKey} />
    </HiddenSlidesProvider>
  )
}

beforeEach(() => {
  vi.mocked(setSlideVisibility).mockReset()
})

describe('VisibilityToggle', () => {
  test('renders nothing for slides flagged non-hideable in the registry', () => {
    const { container } = renderToggle('cover')

    expect(container).toBeEmptyDOMElement()
  })

  test('shows the toggle in the on position when the slide is visible', () => {
    renderToggle('ga_summary')

    expect(screen.getByTestId('visibility-switch-ga_summary')).toHaveAttribute(
      'data-state',
      'checked'
    )
  })

  test('shows the toggle in the off position when the slide is hidden', () => {
    renderToggle('ga_summary', ['ga_summary'])

    expect(screen.getByTestId('visibility-switch-ga_summary')).toHaveAttribute(
      'data-state',
      'unchecked'
    )
  })

  test('hides the slide when clicked while visible', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: true })

    renderToggle('ga_summary')

    fireEvent.click(screen.getByTestId('visibility-switch-ga_summary'))

    await waitFor(() => {
      expect(setSlideVisibility).toHaveBeenCalledWith('r1', 'ga_summary', true)
    })
  })
})
