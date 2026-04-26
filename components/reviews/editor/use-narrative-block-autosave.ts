'use client'

// Caller must remount this hook (e.g. via `key={`${reviewId}:${blockKey}`}` on the
// field component) when switching to a different review/block. The hook seeds
// `value` from `initialValue` on mount only and does not track later changes to
// the prop — syncing via effect would clobber in-progress edits whenever a
// parent re-renders with stale data.

import { useCallback, useEffect, useRef, useState } from 'react'
import { updateNarrative } from '@/lib/reviews/actions'
import type { NarrativeBlocks } from '@/lib/reviews/types'

export const AUTOSAVE_DELAY_MS = 1500

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

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
  const valueRef = useRef(initialValue)
  const requestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const setValue = useCallback(
    (next: string) => {
      if (next === valueRef.current) return
      valueRef.current = next
      setValueState(next)
      setStatus('saving')
      setErrorMessage(null)

      if (timerRef.current) clearTimeout(timerRef.current)
      const requestId = ++requestIdRef.current
      timerRef.current = setTimeout(async () => {
        const result = await updateNarrative(reviewId, blockKey, next)
        // Drop the resolution if a newer save has been dispatched in the
        // meantime — its outcome is the one the UI should reflect.
        if (requestId !== requestIdRef.current) return
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
