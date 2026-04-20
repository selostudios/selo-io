'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShareModal } from '@/components/share/share-modal'
import { SharedResourceType } from '@/lib/enums'

export interface SnapshotShareButtonProps {
  snapshotId: string
}

/**
 * Thin client wrapper for the snapshot detail page's Share action.
 *
 * The surrounding page is a server component; only this button needs
 * client-side state (modal open/close), so it's isolated here to keep the
 * page otherwise server-rendered.
 */
export function SnapshotShareButton({ snapshotId }: SnapshotShareButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="performance-reports-snapshot-share-button"
      >
        <Share2 className="mr-2 size-4" aria-hidden="true" />
        Share
      </Button>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        resourceType={SharedResourceType.MarketingReview}
        resourceId={snapshotId}
      />
    </>
  )
}
