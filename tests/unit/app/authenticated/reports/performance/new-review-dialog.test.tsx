import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))

const checkReviewExists = vi.fn()
const createReview = vi.fn()

vi.mock('@/lib/reviews/actions', () => ({
  checkReviewExists: (...args: unknown[]) => checkReviewExists(...args),
  createReview: (...args: unknown[]) => createReview(...args),
}))

import { NewReviewDialog } from '@/app/(authenticated)/[orgId]/reports/performance/new-review-dialog'

const ORG_ID = '11111111-1111-1111-1111-111111111111'
const QUARTERS = ['2026-Q2', '2026-Q1', '2025-Q4']

describe('NewReviewDialog', () => {
  beforeEach(() => {
    checkReviewExists.mockReset()
    createReview.mockReset()
  })

  test('does not render the form until the trigger is clicked', () => {
    render(<NewReviewDialog orgId={ORG_ID} quarters={QUARTERS} defaultQuarter="2026-Q2" />)
    expect(screen.queryByTestId('new-review-form')).toBeNull()
    expect(screen.getByTestId('performance-reports-new-button')).toBeInTheDocument()
  })

  test('renders the form inside the dialog when the trigger is clicked', async () => {
    render(<NewReviewDialog orgId={ORG_ID} quarters={QUARTERS} defaultQuarter="2026-Q2" />)
    fireEvent.click(screen.getByTestId('performance-reports-new-button'))

    const form = await screen.findByTestId('new-review-form')
    expect(form).toBeInTheDocument()
    expect(screen.getByTestId('performance-reports-new-dialog')).toBeInTheDocument()
  })

  test('submits the form from within the dialog', async () => {
    checkReviewExists.mockResolvedValueOnce({ exists: false })
    createReview.mockResolvedValueOnce({ success: true, reviewId: 'review-abc' })

    render(<NewReviewDialog orgId={ORG_ID} quarters={QUARTERS} defaultQuarter="2026-Q2" />)
    fireEvent.click(screen.getByTestId('performance-reports-new-button'))
    await screen.findByTestId('new-review-form')
    fireEvent.click(screen.getByTestId('new-review-submit'))

    await waitFor(() => {
      expect(checkReviewExists).toHaveBeenCalledWith(ORG_ID, '2026-Q2')
    })
    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          quarter: '2026-Q2',
          overwrite: false,
        })
      )
    })
  })
})
