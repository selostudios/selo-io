'use client'

import { useState, useEffect } from 'react'
import type { AuditProgress } from '@/lib/audit/types'

export function useAuditPolling(auditId: string, enabled: boolean) {
  const [progress, setProgress] = useState<AuditProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return

    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch(`/api/audit/${auditId}/status`)
        const data = await response.json()
        setProgress(data)
        setIsLoading(false)

        // Continue polling if not complete/failed
        if (data.status === 'pending' || data.status === 'crawling') {
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
  }, [auditId, enabled])

  return { progress, isLoading }
}
