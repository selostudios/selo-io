'use client'

import { useState, useEffect } from 'react'
import { AIOAuditStatus } from '@/lib/enums'
import type { AIOAudit, AIOCheck } from '@/lib/aio/types'

interface AIOAuditPollingResult {
  audit: AIOAudit | null
  checks: AIOCheck[]
  isPolling: boolean
}

export function useAIOAuditPolling(auditId: string): AIOAuditPollingResult {
  const [audit, setAudit] = useState<AIOAudit | null>(null)
  const [checks, setChecks] = useState<AIOCheck[]>([])
  const [isPolling, setIsPolling] = useState(true)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch(`/api/aio/audit/${auditId}/status`)
        if (response.ok) {
          const data = await response.json()
          setAudit(data.audit)
          setChecks(data.checks ?? [])

          // Stop polling if audit is complete or failed
          if (
            data.audit?.status === AIOAuditStatus.Completed ||
            data.audit?.status === AIOAuditStatus.Failed
          ) {
            setIsPolling(false)
            return
          }

          // Continue polling every 2 seconds
          timeoutId = setTimeout(poll, 2000)
        } else {
          console.error('[AIO Audit Polling] HTTP error:', response.status)
          timeoutId = setTimeout(poll, 2000) // Retry on error
        }
      } catch (error) {
        console.error('[AIO Audit Polling] Fetch error:', error)
        timeoutId = setTimeout(poll, 2000) // Retry on error
      }
    }

    poll()

    return () => clearTimeout(timeoutId)
  }, [auditId])

  return { audit, checks, isPolling }
}
