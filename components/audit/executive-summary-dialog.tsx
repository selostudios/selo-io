'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ExecutiveSummaryDialogProps {
  summary: string
  url: string
}

export function ExecutiveSummaryDialog({ summary, url }: ExecutiveSummaryDialogProps) {
  const [open, setOpen] = useState(false)
  const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Executive Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Executive Summary</DialogTitle>
          <DialogDescription>{displayUrl}</DialogDescription>
        </DialogHeader>
        <div className="text-foreground space-y-3 text-sm leading-relaxed">
          {summary.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
