import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SnapshotShareButton } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/snapshot-client'
import { SharedResourceType } from '@/lib/enums'

const shareModal = vi.fn(
  (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    resourceType: SharedResourceType
    resourceId: string
  }) => {
    return props.open ? (
      <div data-testid="share-modal-stub">
        {props.resourceType}:{props.resourceId}
      </div>
    ) : null
  }
)

vi.mock('@/components/share/share-modal', () => ({
  ShareModal: (props: Parameters<typeof shareModal>[0]) => shareModal(props),
}))

const SNAPSHOT_ID = 'snap-abc-123'

describe('SnapshotShareButton', () => {
  beforeEach(() => {
    shareModal.mockClear()
  })

  test('does not render the share modal until the Share button is clicked', () => {
    render(<SnapshotShareButton snapshotId={SNAPSHOT_ID} />)

    expect(screen.queryByTestId('share-modal-stub')).toBeNull()
    // Modal is always mounted in the DOM (for animation) — what matters is
    // its `open` prop is false on initial render.
    const lastCall = shareModal.mock.calls.at(-1)?.[0]
    expect(lastCall?.open).toBe(false)
  })

  test('opens the share modal with the snapshot id when the button is clicked', () => {
    render(<SnapshotShareButton snapshotId={SNAPSHOT_ID} />)

    fireEvent.click(screen.getByTestId('performance-reports-snapshot-share-button'))

    const stub = screen.getByTestId('share-modal-stub')
    expect(stub).toBeInTheDocument()
    expect(stub).toHaveTextContent(`${SharedResourceType.MarketingReview}:${SNAPSHOT_ID}`)
  })

  test('passes the MarketingReview resource type so the public share route dispatches correctly', () => {
    render(<SnapshotShareButton snapshotId={SNAPSHOT_ID} />)

    fireEvent.click(screen.getByTestId('performance-reports-snapshot-share-button'))

    const lastCall = shareModal.mock.calls.at(-1)?.[0]
    expect(lastCall?.resourceType).toBe(SharedResourceType.MarketingReview)
    expect(lastCall?.resourceId).toBe(SNAPSHOT_ID)
    expect(lastCall?.open).toBe(true)
  })
})
