import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PreviewClient } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/preview/preview-client'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

// Captured refs so individual tests can inspect/override behaviour.
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

const defaultProps = {
  reviewId: REVIEW_ID,
  orgId: ORG_ID,
  organization: {
    name: 'Acme Corp',
    logo_url: null as string | null,
    primary_color: null as string | null,
  },
  quarter: 'Q1 2026',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  narrative: {
    cover_subtitle: 'Strong start',
    ga_summary: 'Traffic grew 18%.',
    linkedin_insights: 'Engagement up.',
    initiatives: 'Shipped campaign.',
    takeaways: 'Brand search doubled.',
    planning: 'Double down.',
  } satisfies NarrativeBlocks,
  data: {} satisfies SnapshotData,
  hiddenSlides: [],
}

describe('PreviewClient', () => {
  beforeEach(() => {
    routerPush.mockReset()
    publishReview.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
  })

  test('renders the not-yet-published banner text by default', () => {
    render(<PreviewClient {...defaultProps} />)

    expect(screen.getByText('Preview of current draft — not yet published.')).toBeInTheDocument()
  })

  test('navigates back to the editor when "Back to editor" is clicked', () => {
    render(<PreviewClient {...defaultProps} />)

    fireEvent.click(screen.getByTestId('performance-reports-preview-back-button'))

    expect(routerPush).toHaveBeenCalledWith(`/${ORG_ID}/reports/performance/${REVIEW_ID}`)
  })

  test('publishes the review and navigates to the new snapshot on success', async () => {
    publishReview.mockResolvedValueOnce({
      success: true,
      snapshotId: 'snap-abc',
      version: 1,
    })

    render(<PreviewClient {...defaultProps} />)

    fireEvent.click(screen.getByTestId('performance-reports-preview-publish-button'))

    await waitFor(() => {
      expect(publishReview).toHaveBeenCalledWith(REVIEW_ID)
    })

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots/snap-abc`
      )
    })
    expect(showSuccess).toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  test('shows an error toast when publishReview fails and does not navigate', async () => {
    publishReview.mockResolvedValueOnce({
      success: false,
      error: 'Nothing to publish — narrative is empty',
    })

    render(<PreviewClient {...defaultProps} />)

    fireEvent.click(screen.getByTestId('performance-reports-preview-publish-button'))

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Nothing to publish — narrative is empty')
    })
    expect(routerPush).not.toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
  })

  test('keeps the banner visible at all times so the back-to-editor control is always reachable', () => {
    render(<PreviewClient {...defaultProps} />)

    expect(screen.getByTestId('performance-reports-preview-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('performance-reports-preview-dismiss-button')).toBeNull()
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

    render(<PreviewClient {...defaultProps} />)

    const publishButton = screen.getByTestId('performance-reports-preview-publish-button')
    fireEvent.click(publishButton)

    await waitFor(() => {
      expect(publishButton).toHaveTextContent('Publishing…')
    })
    expect(publishButton).toBeDisabled()

    // Resolve the pending publish so the transition can finish cleanly.
    resolvePublish({ success: true, snapshotId: 'snap-abc', version: 1 })
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        `/${ORG_ID}/reports/performance/${REVIEW_ID}/snapshots/snap-abc`
      )
    })
  })
})
