import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  SnapshotRowShareButton,
  SnapshotsTable,
  type SnapshotListItem,
} from '@/app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/snapshots-client'
import { SharedResourceType } from '@/lib/enums'

const shareModal = vi.fn(
  (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    resourceType: SharedResourceType
    resourceId: string
  }) => {
    return props.open ? (
      <div data-testid={`share-modal-stub-${props.resourceId}`}>
        {props.resourceType}:{props.resourceId}
      </div>
    ) : null
  }
)

vi.mock('@/components/share/share-modal', () => ({
  ShareModal: (props: Parameters<typeof shareModal>[0]) => shareModal(props),
}))

const sampleSnapshots: SnapshotListItem[] = [
  {
    id: 'snap-3',
    version: 3,
    publishedAt: 'Apr 20, 2026',
    publishedByName: 'Jane Doe',
    hasShareLink: true,
  },
  {
    id: 'snap-2',
    version: 2,
    publishedAt: 'Apr 5, 2026',
    publishedByName: 'Ada Lovelace',
    hasShareLink: false,
  },
  {
    id: 'snap-1',
    version: 1,
    publishedAt: 'Mar 15, 2026',
    publishedByName: null,
    hasShareLink: false,
  },
]

const BASE = '/org-1/reports/performance/review-1/snapshots'

describe('SnapshotsTable', () => {
  beforeEach(() => {
    shareModal.mockClear()
  })

  test('renders one row per snapshot with version, date, and publisher', () => {
    render(<SnapshotsTable snapshots={sampleSnapshots} basePath={BASE} />)

    // All three rows are present.
    expect(screen.getByTestId('performance-reports-snapshots-row-snap-3')).toBeInTheDocument()
    expect(screen.getByTestId('performance-reports-snapshots-row-snap-2')).toBeInTheDocument()
    expect(screen.getByTestId('performance-reports-snapshots-row-snap-1')).toBeInTheDocument()

    // Published dates render verbatim from the pre-formatted string.
    expect(screen.getByText('Apr 20, 2026')).toBeInTheDocument()
    expect(screen.getByText('Apr 5, 2026')).toBeInTheDocument()

    // Publisher names come from the resolved map; missing names show em-dash.
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()

    const row1 = screen.getByTestId('performance-reports-snapshots-row-snap-1')
    expect(row1).toHaveTextContent('—')
  })

  test('version links point to the snapshot detail page under the base path', () => {
    render(<SnapshotsTable snapshots={sampleSnapshots} basePath={BASE} />)

    const v3Link = screen.getByTestId('performance-reports-snapshots-version-link-snap-3')
    expect(v3Link).toHaveAttribute('href', `${BASE}/snap-3`)
  })

  test('shows "Link created" only for snapshots that have a share token', () => {
    render(<SnapshotsTable snapshots={sampleSnapshots} basePath={BASE} />)

    const row3 = screen.getByTestId('performance-reports-snapshots-row-snap-3')
    const row2 = screen.getByTestId('performance-reports-snapshots-row-snap-2')

    expect(row3).toHaveTextContent('Link created')
    expect(row3).not.toHaveTextContent('Not shared')

    expect(row2).toHaveTextContent('Not shared')
    expect(row2).not.toHaveTextContent('Link created')
  })

  test('renders the empty state when snapshots is empty', () => {
    render(<SnapshotsTable snapshots={[]} basePath={BASE} />)

    expect(screen.getByTestId('performance-reports-snapshots-empty-state')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/No snapshots yet/i)).toBeInTheDocument()
  })

  test("clicking a row's Share button opens ShareModal with that row's snapshot id", () => {
    render(<SnapshotsTable snapshots={sampleSnapshots} basePath={BASE} />)

    fireEvent.click(screen.getByTestId('performance-reports-snapshots-share-button-snap-2'))

    const modal = screen.getByTestId('share-modal-stub-snap-2')
    expect(modal).toHaveTextContent(`${SharedResourceType.MarketingReview}:snap-2`)
    // Other rows' modals stay closed.
    expect(screen.queryByTestId('share-modal-stub-snap-3')).toBeNull()
    expect(screen.queryByTestId('share-modal-stub-snap-1')).toBeNull()
  })

  test('each row owns independent modal state (row A click does not open row B)', () => {
    render(<SnapshotsTable snapshots={sampleSnapshots} basePath={BASE} />)

    fireEvent.click(screen.getByTestId('performance-reports-snapshots-share-button-snap-3'))
    expect(screen.getByTestId('share-modal-stub-snap-3')).toBeInTheDocument()

    // Clicking row snap-1's button opens its own, snap-3 stays open too.
    fireEvent.click(screen.getByTestId('performance-reports-snapshots-share-button-snap-1'))
    expect(screen.getByTestId('share-modal-stub-snap-1')).toBeInTheDocument()
    expect(screen.getByTestId('share-modal-stub-snap-3')).toBeInTheDocument()
  })
})

describe('SnapshotRowShareButton', () => {
  beforeEach(() => {
    shareModal.mockClear()
  })

  test('passes the MarketingReview resource type so the public share route dispatches correctly', () => {
    render(<SnapshotRowShareButton snapshotId="snap-xyz" version={5} />)

    fireEvent.click(screen.getByTestId('performance-reports-snapshots-share-button-snap-xyz'))

    const lastCall = shareModal.mock.calls.at(-1)?.[0]
    expect(lastCall?.resourceType).toBe(SharedResourceType.MarketingReview)
    expect(lastCall?.resourceId).toBe('snap-xyz')
    expect(lastCall?.open).toBe(true)
  })

  test('exposes an accessible label that identifies which version is being shared', () => {
    render(<SnapshotRowShareButton snapshotId="snap-xyz" version={7} />)

    const button = screen.getByTestId('performance-reports-snapshots-share-button-snap-xyz')
    expect(button).toHaveAttribute('aria-label', 'Share version 7')
  })
})
