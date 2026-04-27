import Link from 'next/link'
import { Presentation } from 'lucide-react'
import { HeaderActionButton } from './header-action-button'

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
    <HeaderActionButton asChild data-testid="report-preview-button">
      <Link href={`/${orgId}/reports/performance/${reviewId}/preview`}>
        <Presentation className="size-4" aria-hidden="true" />
        Preview
      </Link>
    </HeaderActionButton>
  )
}
