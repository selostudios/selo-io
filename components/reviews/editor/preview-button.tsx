import Link from 'next/link'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PreviewButtonProps {
  orgId: string
  reviewId: string
}

/**
 * Header action button that links to the read-only preview deck for the
 * supplied review. Server component — no interactivity beyond navigation.
 */
export function PreviewButton({ orgId, reviewId }: PreviewButtonProps) {
  return (
    <Button variant="outline" asChild data-testid="report-preview-button">
      <Link href={`/${orgId}/reports/performance/${reviewId}/preview`}>
        <Eye className="size-4" aria-hidden="true" />
        Preview
      </Link>
    </Button>
  )
}
