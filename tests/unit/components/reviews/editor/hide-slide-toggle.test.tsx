import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/reviews/actions', () => ({
  setSlideVisibility: vi.fn(),
}))

vi.mock('@/components/ui/sonner', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

import { HideSlideToggle } from '@/components/reviews/editor/hide-slide-toggle'
import { setSlideVisibility } from '@/lib/reviews/actions'
import { showError } from '@/components/ui/sonner'

const REVIEW_ID = 'r1'

beforeEach(() => {
  vi.mocked(setSlideVisibility).mockReset()
  vi.mocked(showError).mockReset()
})

describe('HideSlideToggle', () => {
  test('calls setSlideVisibility with hidden=true when toggling a visible slide', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: true })

    render(<HideSlideToggle reviewId={REVIEW_ID} slideKey="ga_summary" hidden={false} hideable />)

    fireEvent.click(screen.getByRole('button', { name: /hide ga_summary/i }))

    await waitFor(() => {
      expect(setSlideVisibility).toHaveBeenCalledWith(REVIEW_ID, 'ga_summary', true)
    })
  })

  test('calls setSlideVisibility with hidden=false when toggling a hidden slide', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: true })

    render(<HideSlideToggle reviewId={REVIEW_ID} slideKey="ga_summary" hidden hideable />)

    fireEvent.click(screen.getByRole('button', { name: /show ga_summary/i }))

    await waitFor(() => {
      expect(setSlideVisibility).toHaveBeenCalledWith(REVIEW_ID, 'ga_summary', false)
    })
  })

  test('shows an error toast when setSlideVisibility fails', async () => {
    vi.mocked(setSlideVisibility).mockResolvedValueOnce({ success: false, error: 'Boom' })

    render(<HideSlideToggle reviewId={REVIEW_ID} slideKey="ga_summary" hidden={false} hideable />)

    fireEvent.click(screen.getByRole('button', { name: /hide ga_summary/i }))

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Boom')
    })
  })

  test('renders an inert dash and no button when hideable is false', () => {
    render(
      <HideSlideToggle reviewId={REVIEW_ID} slideKey="cover" hidden={false} hideable={false} />
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
