'use client'

import { useState, useEffect, useRef } from 'react'

export interface UsePollingOptions<T> {
  /** Must be stable (wrap in useCallback) — a new reference restarts the polling loop. */
  fetcher: () => Promise<T>
  enabled: boolean
  intervalMs?: number
  errorIntervalMs?: number
  isComplete: (data: T) => boolean
  onComplete?: (data: T) => void
}

export interface UsePollingResult<T> {
  data: T | null
  isLoading: boolean
}

export function usePolling<T>({
  fetcher,
  enabled,
  intervalMs = 2000,
  errorIntervalMs = 5000,
  isComplete,
  onComplete,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const onCompleteRef = useRef(onComplete)
  const isCompleteRef = useRef(isComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
    isCompleteRef.current = isComplete
  })

  useEffect(() => {
    if (!enabled) return

    let timeoutId: NodeJS.Timeout
    let cancelled = false

    const poll = async () => {
      try {
        const result = await fetcher()
        if (cancelled) return
        setData(result)
        setIsLoading(false)

        if (isCompleteRef.current(result)) {
          onCompleteRef.current?.(result)
          return
        }

        timeoutId = setTimeout(poll, intervalMs)
      } catch {
        if (cancelled) return
        timeoutId = setTimeout(poll, errorIntervalMs)
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [enabled, fetcher, intervalMs, errorIntervalMs])

  return { data, isLoading }
}
