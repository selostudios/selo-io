'use client'

import type { ReactNode } from 'react'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { SlideNoteButton } from '../slide-note-button'

interface TrayShellProps {
  reviewId: string
  blockKey: keyof NarrativeBlocks
  /**
   * Per-slide note value to seed the popover. `null` hides the button entirely
   * (used for non-admin viewers — notes are admin-only).
   */
  noteInitialValue: string | null
  children: ReactNode
}

/**
 * Wraps a tray editor field with an admin-only "AI note" button row. When
 * `noteInitialValue` is `null` the row is omitted entirely so non-admins
 * never see the affordance.
 */
export function TrayShell({ reviewId, blockKey, noteInitialValue, children }: TrayShellProps) {
  if (noteInitialValue === null) {
    return <>{children}</>
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SlideNoteButton reviewId={reviewId} blockKey={blockKey} initialValue={noteInitialValue} />
      </div>
      {children}
    </div>
  )
}
