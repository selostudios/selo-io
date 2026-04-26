'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { updateNarrative } from '@/lib/reviews/actions'
import type { NarrativeBlocks } from '@/lib/reviews/types'

export const AUTOSAVE_DELAY_MS = 1500

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseNarrativeBlockAutosaveResult {
  value: string
  setValue: (next: string) => void
  status: AutosaveStatus
  errorMessage: string | null
}

export function useNarrativeBlockAutosave(
  reviewId: string,
  blockKey: keyof NarrativeBlocks,
  initialValue: string
): UseNarrativeBlockAutosaveResult {
  const [value, setValueState] = useState(initialValue)
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel any pending timer when the component unmounts so a stale save
  // doesn't fire after the user has navigated away.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const setValue = useCallback(
    (next: string) => {
      setValueState(next)
      // Optimistically flip to "saving" the moment the user types so the UI
      // can show progress through the debounce window.
      setStatus('saving')
      setErrorMessage(null)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const result = await updateNarrative(reviewId, blockKey, next)
        if (result.success) {
          setStatus('saved')
          setErrorMessage(null)
        } else {
          setStatus('error')
          setErrorMessage(result.error)
        }
      }, AUTOSAVE_DELAY_MS)
    },
    [reviewId, blockKey]
  )

  return { value, setValue, status, errorMessage }
}
