'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { updateAuthorNotes } from '@/lib/reviews/actions'

const AUTOSAVE_DELAY_MS = 1500

interface Props {
  reviewId: string
  initialNotes: string
  canEdit: boolean
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

export function AuthorNotesEditor({ reviewId, initialNotes, canEdit }: Props) {
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
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
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
    <div
      className="relative overflow-hidden rounded-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/60 p-5 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/30 dark:via-slate-950 dark:to-purple-950/30"
      data-testid="author-notes-editor"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600"
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="author-notes"
            className="flex items-center gap-2 text-sm font-semibold text-indigo-950 dark:text-indigo-100"
          >
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Context for the AI
            <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2 text-xs">
            {status === 'saving' && (
              <span
                className="text-indigo-700 dark:text-indigo-300"
                data-testid="author-notes-save-status"
              >
                Saving…
              </span>
            )}
            {status === 'saved' && (
              <span
                className="text-indigo-700 dark:text-indigo-300"
                data-testid="author-notes-save-status"
              >
                Saved
              </span>
            )}
            {status === 'error' && (
              <span className="text-destructive" data-testid="author-notes-save-status">
                {errorMessage ?? 'Save failed'}
              </span>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Not shown in the deck. Used only as context for the AI — edits take effect the next time
          you regenerate the narrative.
        </p>
        <Textarea
          id="author-notes"
          data-testid="author-notes-textarea"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          rows={4}
          placeholder="Notes about this quarter the AI should consider — campaigns run, team changes, product launches, reasons for big movements, etc."
          disabled={!canEdit}
          className="border-indigo-200 bg-white/80 placeholder:text-indigo-400/70 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30 dark:border-indigo-500/30 dark:bg-slate-950/60 dark:placeholder:text-indigo-300/40 dark:focus-visible:border-indigo-400"
        />
      </div>
    </div>
  )
}
