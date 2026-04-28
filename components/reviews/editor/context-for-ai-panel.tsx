'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { updateAuthorNotes } from '@/lib/reviews/actions'

const AUTOSAVE_DELAY_MS = 1500

type Status = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  reviewId: string
  initialNotes: string
  canEdit: boolean
  accentColor?: string | null
}

export function ContextForAiPanel({ reviewId, initialNotes, canEdit, accentColor }: Props) {
  const [value, setValue] = useState(initialNotes)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

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

    // Bump request id synchronously so any in-flight save started before this
    // keystroke can detect it's stale when it resolves.
    const requestId = ++requestIdRef.current

    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('saving')
    timerRef.current = setTimeout(async () => {
      const result = await updateAuthorNotes(reviewId, next)
      if (requestId !== requestIdRef.current) return
      if (result.success) {
        setStatus('saved')
        setErrorMessage(null)
      } else {
        setStatus('error')
        setErrorMessage(result.error)
      }
    }, AUTOSAVE_DELAY_MS)
  }

  const accent = accentColor || 'var(--foreground)'

  return (
    <section
      className="space-y-2 rounded-r-md border-l-4 bg-neutral-50/60 py-3 pr-4 pl-4"
      style={{ borderLeftColor: accent }}
      data-testid="context-for-ai-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="context-for-ai-heading"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Sparkles className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
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
      <p id="context-for-ai-hint" className="text-muted-foreground text-xs">
        Not shown in the deck. Used as context for the AI when you publish, and to improve future
        reports.
      </p>
      <Textarea
        aria-labelledby="context-for-ai-heading"
        aria-describedby="context-for-ai-hint"
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
