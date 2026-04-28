'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { UploadCloud } from 'lucide-react'
import { HeaderActionButton } from './header-action-button'
import { showError, showSuccess } from '@/components/ui/sonner'
import { publishReview } from '@/lib/reviews/actions'

export interface PublishButtonProps {
  orgId: string
  reviewId: string
}

/**
 * Header action button that publishes the current draft. The publish flow is
 * always allowed at the component level; callers (the editor page) decide
 * whether to render this button based on the user's permissions. The server
 * action is the source of truth for empty-draft validation and authorization.
 */
export function PublishButton({ orgId, reviewId }: PublishButtonProps) {
  const router = useRouter()
  const [isPublishing, startPublishTransition] = useTransition()

  function handlePublish() {
    startPublishTransition(async () => {
      const result = await publishReview(reviewId)
      if (result.success) {
        showSuccess(`Published v${result.version}`)
        router.push(`/${orgId}/reports/performance/${reviewId}/snapshots/${result.snapshotId}`)
      } else {
        showError(result.error)
      }
    })
  }

  return (
    <HeaderActionButton
      type="button"
      emphasis="primary"
      onClick={handlePublish}
      disabled={isPublishing}
      data-testid="report-publish-button"
    >
      <UploadCloud className="size-4" aria-hidden="true" />
      {isPublishing ? 'Publishing…' : 'Publish'}
    </HeaderActionButton>
  )
}
