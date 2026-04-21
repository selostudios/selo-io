'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowLeft, Eye, FileStack, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showError, showSuccess } from '@/components/ui/sonner'
import { publishReview } from '@/lib/reviews/actions'

export interface EditorHeaderProps {
  orgId: string
  reviewId: string
  title: string
  quarter: string
  canEdit: boolean
}

/**
 * Editor page header: shows the review title/quarter on the left and a row of
 * navigation/action buttons on the right. The Publish button is the only one
 * that performs a mutation; Preview and Snapshots are plain links to the
 * read-only routes implemented in Tasks 4 and 6.
 *
 * The Publish button is only rendered for admins + internal users (callers
 * compute `canEdit`); the server action is the source of truth for empty-draft
 * validation, so we never pre-disable the button based on narrative contents.
 */
export function EditorHeader({ orgId, reviewId, title, quarter, canEdit }: EditorHeaderProps) {
  const router = useRouter()
  const [isPublishing, startPublishTransition] = useTransition()

  const previewHref = `/${orgId}/reports/performance/${reviewId}/preview`
  const snapshotsHref = `/${orgId}/reports/performance/${reviewId}/snapshots`

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
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{quarter}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild data-testid="performance-reports-editor-back-button">
          <Link href={`/${orgId}/reports/performance`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
        </Button>
        <Button variant="outline" asChild data-testid="performance-reports-editor-preview-button">
          <Link href={previewHref}>
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </Link>
        </Button>
        {canEdit && (
          <Button
            type="button"
            variant="default"
            onClick={handlePublish}
            disabled={isPublishing}
            data-testid="performance-reports-editor-publish-button"
          >
            <UploadCloud className="size-4" aria-hidden="true" />
            {isPublishing ? 'Publishing…' : 'Publish'}
          </Button>
        )}
        <Button variant="outline" asChild data-testid="performance-reports-editor-snapshots-button">
          <Link href={snapshotsHref}>
            <FileStack className="size-4" aria-hidden="true" />
            Snapshots
          </Link>
        </Button>
      </div>
    </div>
  )
}
