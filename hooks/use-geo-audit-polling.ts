'use client'

import { useState, useEffect } from 'react'
import type { GEOAudit, GEOCheck } from '@/lib/geo/types'

interface GEOAuditPollingResult {
  audit: GEOAudit | null
  checks: GEOCheck[]
  isPolling: boolean
}

export function useGEOAuditPolling(auditId: string): GEOAuditPollingResult {
  const [audit, setAudit] = useState<GEOAudit | null>(null)
  const [checks, setChecks] = useState<GEOCheck[]>([])
  const [isPolling, setIsPolling] = useState(true)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch(`/api/geo/audit/${auditId}/status`)
        if (response.ok) {
          const data = await response.json()
          setAudit(data.audit)
          setChecks(data.checks ?? [])

          // Stop polling if audit is complete or failed
          if (data.audit?.status === 'completed' || data.audit?.status === 'failed') {
            setIsPolling(false)
            return
          }

          // Continue polling every 2 seconds
          timeoutId = setTimeout(poll, 2000)
        } else {
          console.error('[GEO Audit Polling] HTTP error:', response.status)
          timeoutId = setTimeout(poll, 2000) // Retry on error
        }
      } catch (error) {
        console.error('[GEO Audit Polling] Fetch error:', error)
        timeoutId = setTimeout(poll, 2000) // Retry on error
      }
    }

    poll()

    return () => clearTimeout(timeoutId)
  }, [auditId])

  return { audit, checks, isPolling }
}
