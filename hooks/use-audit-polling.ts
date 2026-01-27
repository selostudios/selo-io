'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AuditStatus } from '@/lib/enums'
import type { AuditProgress } from '@/lib/audit/types'

export function useAuditPolling(auditId: string, enabled: boolean) {
  const [progress, setProgress] = useState<AuditProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isContinuing, setIsContinuing] = useState(false)
  const isContinuingRef = useRef(false)

  const triggerContinue = useCallback(async () => {
    // Prevent duplicate continuation calls
    if (isContinuingRef.current) return
    isContinuingRef.current = true
    setIsContinuing(true)

    try {
      const response = await fetch(`/api/audit/${auditId}/continue`, {
        method: 'POST',
      })

      if (!response.ok) {
        console.error('[Audit Continue Error]', {
          type: 'continue_request_failed',
          auditId,
          status: response.status,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[Audit Continue Error]', {
        type: 'continue_request_error',
        auditId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    } finally {
      // Reset after a short delay to allow status to change
      setTimeout(() => {
        isContinuingRef.current = false
        setIsContinuing(false)
      }, 1000)
    }
  }, [auditId])

  useEffect(() => {
    if (!enabled) return

    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch(`/api/audit/${auditId}/status`)
        const data = await response.json()
        setProgress(data)
        setIsLoading(false)

        // Handle batch_complete status - auto-trigger continuation
        if (data.status === AuditStatus.BatchComplete && !isContinuingRef.current) {
          triggerContinue()
          // Continue polling while waiting for next batch to start
          timeoutId = setTimeout(poll, 2000)
          return
        }

        // Continue polling if not complete/failed/stopped
        if (
          data.status === AuditStatus.Pending ||
          data.status === AuditStatus.Crawling ||
          data.status === AuditStatus.Checking ||
          data.status === AuditStatus.BatchComplete
        ) {
          timeoutId = setTimeout(poll, 2000) // 2 seconds
        }
      } catch {
        console.error('[Audit Polling Error]', {
          type: 'fetch_error',
          auditId,
          timestamp: new Date().toISOString(),
        })
        timeoutId = setTimeout(poll, 5000) // Retry after 5s on error
      }
    }

    poll()

    return () => clearTimeout(timeoutId)
  }, [auditId, enabled, triggerContinue])

  return { progress, isLoading, isContinuing }
}
