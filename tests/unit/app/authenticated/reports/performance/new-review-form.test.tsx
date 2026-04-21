import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const routerPush = vi.fn()
const routerRefresh = vi.fn()
const checkReviewExists = vi.fn()
const createReview = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    refresh: routerRefresh,
    back: vi.fn(),
  }),
}))

vi.mock('@/lib/reviews/actions', () => ({
  checkReviewExists: (...args: unknown[]) => checkReviewExists(...args),
  createReview: (...args: unknown[]) => createReview(...args),
}))

import { NewReviewForm } from '@/app/(authenticated)/[orgId]/reports/performance/new/new-review-form'

const ORG_ID = '11111111-1111-1111-1111-111111111111'
const QUARTERS = ['2026-Q1', '2026-Q2', '2026-Q3']
const DEFAULT_QUARTER = '2026-Q2'

function renderForm(overrides: Partial<Parameters<typeof NewReviewForm>[0]> = {}) {
  return render(
    <NewReviewForm
      orgId={ORG_ID}
      quarters={QUARTERS}
      defaultQuarter={DEFAULT_QUARTER}
      {...overrides}
    />
  )
}

describe('NewReviewForm', () => {
  beforeEach(() => {
    routerPush.mockReset()
    routerRefresh.mockReset()
    checkReviewExists.mockReset()
    createReview.mockReset()
  })

  test('creates the review directly when no report exists for the quarter', async () => {
    checkReviewExists.mockResolvedValueOnce({ exists: false })
    createReview.mockResolvedValueOnce({ success: true, reviewId: 'review-1' })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    await waitFor(() => {
      expect(checkReviewExists).toHaveBeenCalledWith(ORG_ID, DEFAULT_QUARTER)
    })
    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          quarter: DEFAULT_QUARTER,
          overwrite: false,
        })
      )
    })
    expect(screen.queryByTestId('new-review-confirm-dialog')).toBeNull()
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(`/${ORG_ID}/reports/performance/review-1`)
    })
  })

  test('surfaces a confirm dialog when an unpublished report already exists', async () => {
    checkReviewExists.mockResolvedValueOnce({
      exists: true,
      reviewId: 'existing-1',
      hasPublishedSnapshots: false,
    })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    const dialog = await screen.findByTestId('new-review-confirm-dialog')
    expect(dialog).toHaveTextContent(/draft report for 2026-Q2 already exists/i)
    expect(dialog).not.toHaveTextContent(/published snapshots/i)
    expect(createReview).not.toHaveBeenCalled()
  })

  test('warns about published snapshots when the existing report has any', async () => {
    checkReviewExists.mockResolvedValueOnce({
      exists: true,
      reviewId: 'existing-1',
      hasPublishedSnapshots: true,
    })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    const dialog = await screen.findByTestId('new-review-confirm-dialog')
    expect(dialog).toHaveTextContent(/published snapshots/i)
    expect(dialog).toHaveTextContent(
      /will permanently delete the existing report, its draft, and all published snapshots/i
    )
  })

  test('cancel closes the dialog without calling createReview', async () => {
    checkReviewExists.mockResolvedValueOnce({
      exists: true,
      reviewId: 'existing-1',
      hasPublishedSnapshots: false,
    })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    await screen.findByTestId('new-review-confirm-dialog')
    fireEvent.click(screen.getByTestId('new-review-confirm-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('new-review-confirm-dialog')).toBeNull()
    })
    expect(createReview).not.toHaveBeenCalled()
  })

  test('confirming replaces the review by calling createReview with overwrite=true', async () => {
    checkReviewExists.mockResolvedValueOnce({
      exists: true,
      reviewId: 'existing-1',
      hasPublishedSnapshots: true,
    })
    createReview.mockResolvedValueOnce({ success: true, reviewId: 'review-99' })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    await screen.findByTestId('new-review-confirm-dialog')
    fireEvent.click(screen.getByTestId('new-review-confirm-proceed'))

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          quarter: DEFAULT_QUARTER,
          overwrite: true,
        })
      )
    })
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(`/${ORG_ID}/reports/performance/review-99`)
    })
    expect(screen.queryByTestId('new-review-confirm-dialog')).toBeNull()
  })

  test('surfaces the error message when the existence check fails', async () => {
    checkReviewExists.mockResolvedValueOnce({ success: false, error: 'lookup failed' })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    const errorNode = await screen.findByTestId('new-review-error')
    expect(errorNode).toHaveTextContent('lookup failed')
    expect(createReview).not.toHaveBeenCalled()
  })

  test('passes author notes from the textarea through to createReview', async () => {
    checkReviewExists.mockResolvedValueOnce({ exists: false })
    createReview.mockResolvedValueOnce({ success: true, reviewId: 'review-1' })

    renderForm()
    fireEvent.change(screen.getByTestId('new-review-author-notes'), {
      target: { value: 'Paid burst in Q1 — expect softer comparables.' },
    })
    fireEvent.click(screen.getByTestId('new-review-submit'))

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          authorNotes: 'Paid burst in Q1 — expect softer comparables.',
        })
      )
    })
  })

  test('surfaces the error message when createReview fails after confirmation', async () => {
    checkReviewExists.mockResolvedValueOnce({
      exists: true,
      reviewId: 'existing-1',
      hasPublishedSnapshots: false,
    })
    createReview.mockResolvedValueOnce({
      success: false,
      error: 'AI narrative generation failed: bad key',
    })

    renderForm()
    fireEvent.click(screen.getByTestId('new-review-submit'))

    await screen.findByTestId('new-review-confirm-dialog')
    fireEvent.click(screen.getByTestId('new-review-confirm-proceed'))

    const errorNode = await screen.findByTestId('new-review-error')
    expect(errorNode).toHaveTextContent('AI narrative generation failed: bad key')
    expect(routerPush).not.toHaveBeenCalled()
  })
})
