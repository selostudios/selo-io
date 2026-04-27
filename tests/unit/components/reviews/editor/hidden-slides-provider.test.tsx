import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/reviews/actions', () => ({
  setSlideVisibility: vi.fn(),
}))

vi.mock('@/components/ui/sonner', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

import {
  HiddenSlidesProvider,
  useHiddenSlides,
} from '@/components/reviews/editor/hidden-slides-provider'
import { setSlideVisibility } from '@/lib/reviews/actions'
import { showError } from '@/components/ui/sonner'

function Probe() {
  const { hiddenSlides, isHidden, toggle } = useHiddenSlides()
  return (
    <div>
      <span data-testid="hidden-list">{hiddenSlides.join(',') || '<none>'}</span>
      <span data-testid="ga-hidden">{isHidden('ga_summary') ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => toggle('ga_summary')}>
        toggle ga
      </button>
    </div>
  )
}

beforeEach(() => {
  vi.mocked(setSlideVisibility).mockReset()
  vi.mocked(showError).mockReset()
})

describe('HiddenSlidesProvider', () => {
  test('flips visibility immediately when toggled and persists via the action', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: true })

    render(
      <HiddenSlidesProvider reviewId="r1" initialHidden={[]}>
        <Probe />
      </HiddenSlidesProvider>
    )

    expect(screen.getByTestId('ga-hidden')).toHaveTextContent('no')

    fireEvent.click(screen.getByText('toggle ga'))

    expect(screen.getByTestId('ga-hidden')).toHaveTextContent('yes')

    await waitFor(() => {
      expect(setSlideVisibility).toHaveBeenCalledWith('r1', 'ga_summary', true)
    })
  })

  test('reveals a hidden slide when toggled again', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: true })

    render(
      <HiddenSlidesProvider reviewId="r1" initialHidden={['ga_summary']}>
        <Probe />
      </HiddenSlidesProvider>
    )

    expect(screen.getByTestId('ga-hidden')).toHaveTextContent('yes')

    fireEvent.click(screen.getByText('toggle ga'))

    expect(screen.getByTestId('ga-hidden')).toHaveTextContent('no')

    await waitFor(() => {
      expect(setSlideVisibility).toHaveBeenCalledWith('r1', 'ga_summary', false)
    })
  })

  test('surfaces an error toast when the server action fails', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: false, error: 'Boom' })

    render(
      <HiddenSlidesProvider reviewId="r1" initialHidden={[]}>
        <Probe />
      </HiddenSlidesProvider>
    )

    fireEvent.click(screen.getByText('toggle ga'))

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Boom')
    })
  })
})
