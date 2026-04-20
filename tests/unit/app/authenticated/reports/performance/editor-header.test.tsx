import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditorHeader } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/editor-header'

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

const ORG_ID = '11111111-1111-1111-1111-111111111111'
const REVIEW_ID = '22222222-2222-2222-2222-222222222222'

const baseProps = {
  orgId: ORG_ID,
  reviewId: REVIEW_ID,
  title: 'Q1 2026 Marketing Review',
  quarter: 'Q1 2026',
  canEdit: true,
}

describe('EditorHeader', () => {
  beforeEach(() => {
    routerPush.mockReset()
    publishReview.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
  })

  test('links to the preview route', () => {
    render(<EditorHeader {...baseProps} />)
    const previewLink = screen.getByTestId('performance-reports-editor-preview-button')
    expect(previewLink.tagName).toBe('A')
    expect(previewLink).toHaveAttribute(
      'href',
      `/${ORG_ID}/reports/performance/${REVIEW_ID}/preview`
    )
  })

  test('links to the snapshots list route', () => {
    render(<EditorHeader {...baseProps} />)
    const snapshotsLink = screen.getByTestId('performance-reports-editor-snapshots-button')
    expect(snapshotsLink.tagName).toBe('A')
    expect(snapshotsLink).toHaveAttribute(
      'href',
      `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots`
    )
  })

  test('hides the publish button for viewers without edit permission', () => {
    render(<EditorHeader {...baseProps} canEdit={false} />)
    expect(screen.queryByTestId('performance-reports-editor-publish-button')).toBeNull()
  })

  test('shows the publish button for users with edit permission', () => {
    render(<EditorHeader {...baseProps} canEdit={true} />)
    expect(screen.getByTestId('performance-reports-editor-publish-button')).toBeInTheDocument()
  })

  test('publishes, toasts the new version, and navigates to the snapshot on success', async () => {
    publishReview.mockResolvedValueOnce({
      success: true,
      snapshotId: 'snap-abc',
      version: 3,
    })

    render(<EditorHeader {...baseProps} />)

    fireEvent.click(screen.getByTestId('performance-reports-editor-publish-button'))

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

    render(<EditorHeader {...baseProps} />)

    fireEvent.click(screen.getByTestId('performance-reports-editor-publish-button'))

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

    render(<EditorHeader {...baseProps} />)

    const publishButton = screen.getByTestId('performance-reports-editor-publish-button')
    fireEvent.click(publishButton)

    await waitFor(() => {
      expect(publishButton).toHaveTextContent('Publishing…')
    })
    expect(publishButton).toBeDisabled()

    resolvePublish({ success: true, snapshotId: 'snap-abc', version: 1 })
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots/snap-abc`
      )
    })
  })
})
