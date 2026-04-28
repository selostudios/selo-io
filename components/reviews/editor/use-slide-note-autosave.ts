'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { updateSlideNote } from '@/lib/reviews/actions'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { AUTOSAVE_DELAY_MS, type AutosaveStatus } from './use-narrative-block-autosave'

interface UseSlideNoteAutosaveResult {
  value: string
  setValue: (next: string) => void
  status: AutosaveStatus
  errorMessage: string | null
}

export function useSlideNoteAutosave(
  reviewId: string,
  blockKey: keyof NarrativeBlocks,
  initialValue: string
): UseSlideNoteAutosaveResult {
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
        const result = await updateSlideNote(reviewId, blockKey, next)
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
