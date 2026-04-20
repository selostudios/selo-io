'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewDeck } from '@/components/reviews/review-deck'
import { publishReview } from '@/lib/reviews/actions'
import { showError, showSuccess } from '@/components/ui/sonner'
import type { NarrativeBlocks } from '@/lib/reviews/types'

export interface PreviewClientProps {
  reviewId: string
  orgId: string
  organization: {
    name: string
    logo_url: string | null
    primary_color: string | null
  }
  quarter: string
  periodStart: string
  periodEnd: string
  narrative: NarrativeBlocks
}

/**
 * Full-viewport draft preview: renders the shared `<ReviewDeck>` and a
 * dismissible banner that lets admins either jump back to the editor or
 * publish the current draft as a new snapshot.
 *
 * The banner uses session-only state (no persistence) — dismissing it hides
 * it until the next page load, so the next visit always sees the "not yet
 * published" reminder.
 */
export function PreviewClient({
  reviewId,
  orgId,
  organization,
  quarter,
  periodStart,
  periodEnd,
  narrative,
}: PreviewClientProps) {
  const router = useRouter()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [isPublishing, startPublishTransition] = useTransition()

  const editorHref = `/${orgId}/reports/performance/${reviewId}`

  function handleBackToEditor() {
    router.push(editorHref)
  }

  function handlePublish() {
    startPublishTransition(async () => {
      const result = await publishReview(reviewId)
      if (result.success) {
        showSuccess('Published — snapshot created.')
        router.push(`/${orgId}/reports/performance/${reviewId}/snapshots/${result.snapshotId}`)
      } else {
        showError(result.error)
      }
    })
  }

  return (
    <div
      data-testid="performance-reports-preview"
      className="bg-background fixed inset-0 z-50 flex flex-col"
    >
      {!bannerDismissed && (
        <div
          role="status"
          data-testid="performance-reports-preview-banner"
          className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <p className="text-sm font-medium">Preview of current draft — not yet published.</p>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBackToEditor}
            data-testid="performance-reports-preview-back-button"
          >
            Back to editor
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing}
            data-testid="performance-reports-preview-publish-button"
          >
            {isPublishing ? 'Publishing…' : 'Publish'}
          </Button>
          <button
            type="button"
            aria-label="Dismiss preview banner"
            onClick={() => setBannerDismissed(true)}
            data-testid="performance-reports-preview-dismiss-button"
            className="ml-1 rounded p-1 text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
        <div className="flex h-full w-full max-w-[1600px] items-center justify-center">
          <ReviewDeck
            organization={organization}
            quarter={quarter}
            periodStart={periodStart}
            periodEnd={periodEnd}
            narrative={narrative}
            data={{}}
          />
        </div>
      </div>
    </div>
  )
}
