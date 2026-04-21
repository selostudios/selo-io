'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { NewReviewForm } from './new/new-review-form'

interface NewReviewDialogProps {
  orgId: string
  quarters: string[]
  defaultQuarter: string
}

export function NewReviewDialog({ orgId, quarters, defaultQuarter }: NewReviewDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="performance-reports-new-button">New Review</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-testid="performance-reports-new-dialog">
        <DialogHeader>
          <DialogTitle>New Performance Report</DialogTitle>
          <DialogDescription>
            Pick a quarter. We&apos;ll seed a draft with the latest data from your connected
            platforms.
          </DialogDescription>
        </DialogHeader>
        <NewReviewForm orgId={orgId} quarters={quarters} defaultQuarter={defaultQuarter} />
      </DialogContent>
    </Dialog>
  )
}
