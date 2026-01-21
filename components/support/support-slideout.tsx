'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
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
  CATEGORY_COLORS,
} from '@/lib/types/feedback'
import { updateFeedbackStatus } from '@/app/support/actions'
import { ImageIcon } from 'lucide-react'

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

  // Build submitter display name
  const submitterName = feedback.submitter
    ? `${feedback.submitter.first_name ?? ''} ${feedback.submitter.last_name ?? ''}`.trim() ||
      'Unknown'
    : 'Unknown'

  const submitterEmail = feedback.submitter?.email
  const orgName = feedback.organization?.name
  const formattedDate = format(new Date(feedback.created_at), "EEE, d MMM 'at' h:mmaaa")

  // Build meta line: "Submitted by Name (Org) on Date • [CATEGORY]"
  const submitterDisplay = orgName ? `${submitterName} (${orgName})` : submitterName

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="flex h-full w-full flex-col sm:max-w-lg">
        <SheetHeader className="gap-1 px-6 pt-6 pb-0">
          <Badge
            className={`mb-1 w-fit ${CATEGORY_COLORS[feedback.category]}`}
            style={{ marginLeft: '-2px' }}
          >
            {CATEGORY_LABELS[feedback.category]}
          </Badge>
          <SheetTitle className="pr-8">{feedback.title}</SheetTitle>
          <SheetDescription asChild>
            <p className="text-muted-foreground text-sm">
              {submitterEmail ? (
                <a href={`mailto:${submitterEmail}`} className="text-blue-600 hover:underline">
                  {submitterDisplay}
                </a>
              ) : (
                <span>{submitterDisplay}</span>
              )}{' '}
              on {formattedDate}
            </p>
          </SheetDescription>
        </SheetHeader>

        {/* Content area - scrollable and grows */}
        <div className="flex-1 overflow-y-auto px-6 pt-3 pb-4">
          {/* Description */}
          <p className="mb-4 text-sm whitespace-pre-wrap">{feedback.description}</p>

          {/* Screenshot Attachment */}
          {feedback.screenshot_url && (
            <div className="mt-3">
              <hr className="border-border mb-2" />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <ImageIcon className="text-muted-foreground h-3 w-3" />
                <a
                  href={feedback.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                >
                  {(() => {
                    const url = feedback.screenshot_url
                    const filename = url.split('/').pop() || 'screenshot'
                    return filename.length > 40 ? filename.slice(0, 40) + '...' : filename
                  })()}
                </a>
              </div>
            </div>
          )}

          {/* Context */}
          {(feedback.page_url || feedback.user_agent) && (
            <div className="mt-4 space-y-2">
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
        </div>

        {/* Form - anchored to bottom */}
        <div className="border-border space-y-4 border-t px-6 py-4">
          {/* Status & Priority */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
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

            <div className="flex-1 space-y-2">
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
          </div>

          {/* Note Textarea */}
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this feedback..."
              rows={3}
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
