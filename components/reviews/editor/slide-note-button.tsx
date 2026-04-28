'use client'

import { StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { useSlideNoteAutosave } from './use-slide-note-autosave'

interface SlideNoteButtonProps {
  reviewId: string
  blockKey: keyof NarrativeBlocks
  initialValue: string
}

/**
 * Per-slide note button for admins. Opens a popover with a textarea so the
 * author can leave the AI durable, slide-specific commentary (e.g. "stop
 * using marketing jargon here", "Q1 is seasonally low"). Notes are saved on
 * the draft, frozen onto the snapshot at publish, and fed to the style-memo
 * learner so recurring patterns can be promoted into the cross-quarter memo.
 */
export function SlideNoteButton({ reviewId, blockKey, initialValue }: SlideNoteButtonProps) {
  const { value, setValue, status, errorMessage } = useSlideNoteAutosave(
    reviewId,
    blockKey,
    initialValue
  )
  const hasNote = value.trim().length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Slide note for AI"
          data-testid={`slide-note-button-${blockKey}`}
          className="relative"
        >
          <StickyNote className="size-4" aria-hidden />
          AI note
          {hasNote && (
            <span
              aria-hidden
              data-testid={`slide-note-indicator-${blockKey}`}
              className="bg-primary absolute -top-1 -right-1 size-2 rounded-full"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-foreground text-sm font-semibold">Note for the AI</div>
            {status !== 'idle' && (
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  'text-xs',
                  status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                )}
                data-testid={`slide-note-status-${blockKey}`}
              >
                {status === 'saving' && 'Saving…'}
                {status === 'saved' && 'Saved'}
                {status === 'error' && (errorMessage ?? 'Save failed')}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Saved with this report and used by the style-memo learner. Quarter-specific facts stay
            put; recurring guidance can shape future quarters.
          </p>
          <Textarea
            data-testid={`slide-note-input-${blockKey}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            placeholder="e.g. Stop using marketing jargon on this slide. Prefer plain English."
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
