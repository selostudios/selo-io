'use client'

import { useEffect, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { updateAuthorNotes } from '@/lib/reviews/actions'

const AUTOSAVE_DELAY_MS = 1500

type Status = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  reviewId: string
  initialNotes: string
  canEdit: boolean
}

export function ContextForAiPanel({ reviewId, initialNotes, canEdit }: Props) {
  const [value, setValue] = useState(initialNotes)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (next: string) => {
    setValue(next)
    setStatus('idle')
    setErrorMessage(null)

    if (!canEdit) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('saving')
    timerRef.current = setTimeout(async () => {
      const result = await updateAuthorNotes(reviewId, next)
      if (result.success) {
        setStatus('saved')
        setErrorMessage(null)
      } else {
        setStatus('error')
        setErrorMessage(result.error)
      }
    }, AUTOSAVE_DELAY_MS)
  }

  return (
    <section className="space-y-2" data-testid="context-for-ai-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 id="context-for-ai-heading" className="text-sm font-semibold tracking-tight">
          Context for AI
        </h2>
        <div className="flex items-center gap-2 text-xs">
          {status === 'saving' && (
            <span
              className="text-muted-foreground"
              data-testid="context-for-ai-save-status"
              role="status"
              aria-live="polite"
            >
              Saving…
            </span>
          )}
          {status === 'saved' && (
            <span
              className="text-muted-foreground"
              data-testid="context-for-ai-save-status"
              role="status"
              aria-live="polite"
            >
              Saved
            </span>
          )}
          {status === 'error' && (
            <span
              className="text-destructive"
              data-testid="context-for-ai-save-status"
              role="status"
              aria-live="polite"
            >
              {errorMessage ?? 'Save failed'}
            </span>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Not shown in the deck. Used as context for the AI when you publish, and to improve future
        reports.
      </p>
      <Textarea
        aria-labelledby="context-for-ai-heading"
        data-testid="context-for-ai-textarea"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        rows={4}
        placeholder="Notes about this quarter the AI should consider — campaigns run, team changes, product launches, reasons for big movements, etc."
        disabled={!canEdit}
      />
    </section>
  )
}
