import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), back: vi.fn() }),
}))

const deleteReview = vi.fn()
vi.mock('@/lib/reviews/actions', () => ({
  deleteReview: (...args: unknown[]) => deleteReview(...args),
}))

import { PerformanceReportRowActions } from '@/app/(authenticated)/[orgId]/reports/performance/report-row-actions'

const ORG_ID = '11111111-1111-1111-1111-111111111111'
const REVIEW_ID = 'review-abc'

describe('PerformanceReportRowActions', () => {
  beforeEach(() => {
    routerRefresh.mockReset()
    deleteReview.mockReset()
  })

  test('renders View Report linking to the review', () => {
    render(<PerformanceReportRowActions orgId={ORG_ID} reviewId={REVIEW_ID} quarter="2026-Q2" />)
    const link = screen.getByRole('link', { name: /view report/i })
    expect(link).toHaveAttribute('href', `/${ORG_ID}/reports/performance/${REVIEW_ID}`)
  })

  test('does not call deleteReview until the dialog is confirmed', () => {
    render(<PerformanceReportRowActions orgId={ORG_ID} reviewId={REVIEW_ID} quarter="2026-Q2" />)
    fireEvent.click(screen.getByTestId(`performance-report-delete-${REVIEW_ID}`))
    expect(deleteReview).not.toHaveBeenCalled()
  })

  test('calls deleteReview and refreshes the router on confirm', async () => {
    deleteReview.mockResolvedValueOnce({ success: true })

    render(<PerformanceReportRowActions orgId={ORG_ID} reviewId={REVIEW_ID} quarter="2026-Q2" />)
    fireEvent.click(screen.getByTestId(`performance-report-delete-${REVIEW_ID}`))
    fireEvent.click(await screen.findByTestId('performance-report-delete-confirm'))

    await waitFor(() => {
      expect(deleteReview).toHaveBeenCalledWith(REVIEW_ID)
    })
    await waitFor(() => {
      expect(routerRefresh).toHaveBeenCalled()
    })
  })

  test('surfaces server errors and keeps the dialog open', async () => {
    deleteReview.mockResolvedValueOnce({ success: false, error: 'Insufficient permissions' })

    render(<PerformanceReportRowActions orgId={ORG_ID} reviewId={REVIEW_ID} quarter="2026-Q2" />)
    fireEvent.click(screen.getByTestId(`performance-report-delete-${REVIEW_ID}`))
    fireEvent.click(await screen.findByTestId('performance-report-delete-confirm'))

    const message = await screen.findByTestId('performance-report-delete-error')
    expect(message).toHaveTextContent('Insufficient permissions')
    expect(routerRefresh).not.toHaveBeenCalled()
  })
})
