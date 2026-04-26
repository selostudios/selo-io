import Link from 'next/link'
import { FileStack } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <Button variant="outline" asChild data-testid="report-snapshots-button">
      <Link href={`/${orgId}/reports/performance/${reviewId}/snapshots`}>
        <FileStack className="size-4" aria-hidden="true" />
        Snapshots
      </Link>
    </Button>
  )
}
