'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteReview } from '@/lib/reviews/actions'

interface PerformanceReportRowActionsProps {
  orgId: string
  reviewId: string
  quarter: string
}

export function PerformanceReportRowActions({
  orgId,
  reviewId,
  quarter,
}: PerformanceReportRowActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      const result = await deleteReview(reviewId)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        asChild
        variant="outline"
        size="sm"
        data-testid={`performance-report-view-${reviewId}`}
      >
        <Link href={`/${orgId}/reports/performance/${reviewId}`}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          View Report
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete report"
        className="text-muted-foreground hover:text-destructive h-8 w-8"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        data-testid={`performance-report-delete-${reviewId}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!isDeleting) setOpen(next)
        }}
      >
        <AlertDialogContent data-testid="performance-report-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the <span className="font-medium">{quarter}</span>{' '}
              performance report? This removes the draft and any published snapshots. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-destructive text-sm" data-testid="performance-report-delete-error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="performance-report-delete-confirm"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete Report'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
