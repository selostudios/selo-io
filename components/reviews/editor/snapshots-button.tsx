import Link from 'next/link'
import { FileStack } from 'lucide-react'
import { HeaderActionButton } from './header-action-button'

export interface SnapshotsButtonProps {
  orgId: string
  reviewId: string
}

/**
 * Header action button that links to the published snapshots list for the
 * supplied review. Server component — no interactivity beyond navigation.
 */
export function SnapshotsButton({ orgId, reviewId }: SnapshotsButtonProps) {
  return (
    <HeaderActionButton asChild data-testid="report-snapshots-button">
      <Link href={`/${orgId}/reports/performance/${reviewId}/snapshots`}>
        <FileStack className="size-4" aria-hidden="true" />
        Snapshots
      </Link>
    </HeaderActionButton>
  )
}
