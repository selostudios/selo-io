'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  type FeedbackWithRelations,
  type FeedbackStatus,
  type FeedbackPriority,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_LABELS,
  STATUS_COLORS,
} from '@/lib/types/feedback'
import { updateFeedbackStatus } from '@/app/support/actions'

interface SupportSlideoutProps {
  feedback: FeedbackWithRelations | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function SupportSlideout({ feedback, open, onClose, onUpdate }: SupportSlideoutProps) {
  const [status, setStatus] = useState<FeedbackStatus | undefined>(undefined)
  const [priority, setPriority] = useState<FeedbackPriority | undefined>(undefined)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when feedback changes
  useEffect(() => {
    if (feedback) {
      setStatus(feedback.status)
      setPriority(feedback.priority ?? undefined)
      setNote(feedback.status_note ?? '')
    }
  }, [feedback])

  const hasChanges =
    feedback &&
    (status !== feedback.status ||
      priority !== (feedback.priority ?? undefined) ||
      note !== (feedback.status_note ?? ''))

  const handleSave = async () => {
    if (!feedback || !hasChanges) return

    setIsSaving(true)
    try {
      const result = await updateFeedbackStatus({
        feedbackId: feedback.id,
        status: status!,
        priority: priority ?? null,
        note: note || null,
      })

      if (result.error) {
        console.error('[Support Slideout Error]', {
          type: 'update_error',
          error: result.error,
          timestamp: new Date().toISOString(),
        })
      } else {
        onUpdate()
        onClose()
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (!feedback) return null

  const submitterName = feedback.submitter
    ? `${feedback.submitter.first_name ?? ''} ${feedback.submitter.last_name ?? ''}`.trim() ||
      feedback.submitter.email ||
      'Unknown'
    : 'Unknown'

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{feedback.title}</SheetTitle>
          <SheetDescription>
            <Badge className={STATUS_COLORS[feedback.status]}>
              {CATEGORY_LABELS[feedback.category]}
            </Badge>
            <span className="text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Description */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs tracking-wider uppercase">
              Description
            </Label>
            <p className="text-sm whitespace-pre-wrap">{feedback.description}</p>
          </div>

          {/* Submitter */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs tracking-wider uppercase">
              Submitted By
            </Label>
            <p className="text-sm">{submitterName}</p>
            {feedback.organization && (
              <p className="text-muted-foreground text-sm">{feedback.organization.name}</p>
            )}
          </div>

          {/* Context */}
          {(feedback.page_url || feedback.user_agent) && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs tracking-wider uppercase">
                Context
              </Label>
              {feedback.page_url && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Page: </span>
                  {feedback.page_url}
                </p>
              )}
              {feedback.user_agent && (
                <p className="text-muted-foreground truncate text-sm" title={feedback.user_agent}>
                  {feedback.user_agent}
                </p>
              )}
            </div>
          )}

          {/* Screenshot */}
          {feedback.screenshot_url && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs tracking-wider uppercase">
                Screenshot
              </Label>
              <a
                href={feedback.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View Screenshot
              </a>
            </div>
          )}

          {/* Divider */}
          <hr className="border-border" />

          {/* Status Select */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as FeedbackStatus)}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Select */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority ?? ''}
              onValueChange={(value) =>
                setPriority(value ? (value as FeedbackPriority) : undefined)
              }
            >
              <SelectTrigger id="priority" className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note Textarea */}
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this feedback..."
              rows={4}
            />
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="w-full">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
