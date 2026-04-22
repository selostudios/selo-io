'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewDeck } from '@/components/reviews/review-deck'
import { publishReview } from '@/lib/reviews/actions'
import { showError, showSuccess } from '@/components/ui/sonner'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

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
  data: SnapshotData
}

/**
 * Full-viewport draft preview: renders the shared `<ReviewDeck>` and a
 * persistent banner that lets admins either jump back to the editor or
 * publish the current draft as a new snapshot. The banner is always visible
 * so navigation is never lost.
 */
export function PreviewClient({
  reviewId,
  orgId,
  organization,
  quarter,
  periodStart,
  periodEnd,
  narrative,
  data,
}: PreviewClientProps) {
  const router = useRouter()
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
      <div
        role="region"
        aria-label="Draft preview status"
        data-testid="performance-reports-preview-banner"
        className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBackToEditor}
          data-testid="performance-reports-preview-back-button"
          className="text-amber-900 hover:bg-amber-100 hover:text-amber-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to editor
        </Button>
        <p className="flex-1 text-sm font-medium">Preview of current draft — not yet published.</p>
        <Button
          type="button"
          size="sm"
          onClick={handlePublish}
          disabled={isPublishing}
          data-testid="performance-reports-preview-publish-button"
        >
          {isPublishing ? 'Publishing…' : 'Publish'}
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
        <div className="flex h-full w-full max-w-[1600px] items-center justify-center">
          <ReviewDeck
            organization={organization}
            quarter={quarter}
            periodStart={periodStart}
            periodEnd={periodEnd}
            narrative={narrative}
            data={data}
          />
        </div>
      </div>
    </div>
  )
}
