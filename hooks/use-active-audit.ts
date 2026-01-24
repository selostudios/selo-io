'use client'

import { useState, useEffect } from 'react'

interface ActiveAuditStatus {
  hasActiveAudit: boolean
  auditId?: string
}

export function useActiveAudit() {
  const [status, setStatus] = useState<ActiveAuditStatus>({ hasActiveAudit: false })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const response = await fetch('/api/audit/active')
        if (response.ok) {
          const data = await response.json()
          setStatus(data)
        }
        setIsLoading(false)

        // Poll every 10 seconds to check for active audits
        timeoutId = setTimeout(poll, 10000)
      } catch {
        console.error('[Active Audit Polling Error]', {
          type: 'fetch_error',
          timestamp: new Date().toISOString(),
        })
        setIsLoading(false)
        timeoutId = setTimeout(poll, 10000) // Retry after 10s on error
      }
    }

    poll()

    return () => clearTimeout(timeoutId)
  }, [])

  return { ...status, isLoading }
}
