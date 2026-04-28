import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PreviewButton } from '@/components/reviews/editor/preview-button'
import { SnapshotsButton } from '@/components/reviews/editor/snapshots-button'
import { PublishButton } from '@/components/reviews/editor/publish-button'

const routerPush = vi.fn()
const publishReview = vi.fn()
const showSuccess = vi.fn()
const showError = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.mock('@/lib/reviews/actions', () => ({
  publishReview: (...args: unknown[]) => publishReview(...args),
}))

vi.mock('@/components/ui/sonner', () => ({
  showSuccess: (...args: unknown[]) => showSuccess(...args),
  showError: (...args: unknown[]) => showError(...args),
}))

const ORG_ID = 'org-1'
const REVIEW_ID = 'rev-q1-2026'

describe('PreviewButton', () => {
  test('renders a link to the preview route with the Preview label', () => {
    render(<PreviewButton orgId={ORG_ID} reviewId={REVIEW_ID} />)

    const link = screen.getByTestId('report-preview-button')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', `/${ORG_ID}/reports/performance/${REVIEW_ID}/preview`)
    expect(link).toHaveTextContent('Preview')
  })
})

describe('SnapshotsButton', () => {
  test('renders a link to the snapshots route with the Snapshots label', () => {
    render(<SnapshotsButton orgId={ORG_ID} reviewId={REVIEW_ID} />)

    const link = screen.getByTestId('report-snapshots-button')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots`)
    expect(link).toHaveTextContent('Snapshots')
  })
})

describe('PublishButton', () => {
  beforeEach(() => {
    routerPush.mockReset()
    publishReview.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
  })

  test('renders a Publish button', () => {
    render(<PublishButton orgId={ORG_ID} reviewId={REVIEW_ID} />)

    const button = screen.getByTestId('report-publish-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Publish')
    expect(button).not.toBeDisabled()
  })

  test('publishes, toasts the new version, and navigates to the snapshot on success', async () => {
    publishReview.mockResolvedValueOnce({
      success: true,
      snapshotId: 'snap-abc',
      version: 3,
    })

    render(<PublishButton orgId={ORG_ID} reviewId={REVIEW_ID} />)

    fireEvent.click(screen.getByTestId('report-publish-button'))

    await waitFor(() => {
      expect(publishReview).toHaveBeenCalledWith(REVIEW_ID)
    })
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots/snap-abc`
      )
    })
    expect(showSuccess).toHaveBeenCalledWith('Published v3')
    expect(showError).not.toHaveBeenCalled()
  })

  test('shows an error toast and does not navigate when publish fails', async () => {
    publishReview.mockResolvedValueOnce({
      success: false,
      error: 'Nothing to publish — narrative is empty',
    })

    render(<PublishButton orgId={ORG_ID} reviewId={REVIEW_ID} />)

    fireEvent.click(screen.getByTestId('report-publish-button'))

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Nothing to publish — narrative is empty')
    })
    expect(routerPush).not.toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
  })

  test('shows the loading label and disables the publish button while publishing', async () => {
    let resolvePublish: (value: {
      success: true
      snapshotId: string
      version: number
    }) => void = () => {}
    const pendingPublish = new Promise<{ success: true; snapshotId: string; version: number }>(
      (resolve) => {
        resolvePublish = resolve
      }
    )
    publishReview.mockReturnValueOnce(pendingPublish)

    render(<PublishButton orgId={ORG_ID} reviewId={REVIEW_ID} />)

    const button = screen.getByTestId('report-publish-button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveTextContent('Publishing…')
    })
    expect(button).toBeDisabled()

    resolvePublish({ success: true, snapshotId: 'snap-xyz', version: 1 })
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots/snap-xyz`
      )
    })
  })
})
