'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { checkReviewExists, createReview } from '@/lib/reviews/actions'

interface Props {
  orgId: string
  quarters: string[]
  defaultQuarter: string
}

export function NewReviewForm({ orgId, quarters, defaultQuarter }: Props) {
  const router = useRouter()
  const [quarter, setQuarter] = useState(defaultQuarter)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    hasPublishedSnapshots: boolean
  }>({ open: false, hasPublishedSnapshots: false })

  const runCreate = (overwrite: boolean) => {
    startTransition(async () => {
      const result = await createReview({ organizationId: orgId, quarter, overwrite })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(`/${orgId}/reports/performance/${result.reviewId}`)
      router.refresh()
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const check = await checkReviewExists(orgId, quarter)
      if ('success' in check && !check.success) {
        setError(check.error)
        return
      }
      if ('exists' in check && check.exists) {
        setConfirmState({ open: true, hasPublishedSnapshots: check.hasPublishedSnapshots })
        return
      }
      runCreate(false)
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" data-testid="new-review-form">
        <div className="space-y-2">
          <label htmlFor="quarter" className="text-sm font-medium">
            Quarter
          </label>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger
              id="quarter"
              className="w-full max-w-xs"
              data-testid="new-review-quarter-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarters.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p className="text-destructive text-sm" data-testid="new-review-error">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending} data-testid="new-review-submit">
            {isPending ? 'Creating…' : 'Create review'}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={confirmState.open}
        onOpenChange={(open) => {
          if (!open) setConfirmState({ open: false, hasPublishedSnapshots: false })
        }}
      >
        <AlertDialogContent data-testid="new-review-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing report for {quarter}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState.hasPublishedSnapshots
                ? `A report for ${quarter} already exists and has published snapshots. Creating a new report will permanently delete the existing report, its draft, and all published snapshots.`
                : `A draft report for ${quarter} already exists. Creating a new report will permanently delete the existing draft.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="new-review-confirm-cancel"
              onClick={() => setConfirmState({ open: false, hasPublishedSnapshots: false })}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="new-review-confirm-proceed"
              onClick={() => {
                setConfirmState({ open: false, hasPublishedSnapshots: false })
                runCreate(true)
              }}
            >
              Replace report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
