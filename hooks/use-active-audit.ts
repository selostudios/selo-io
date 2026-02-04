'use client'

import { useState, useEffect, useRef } from 'react'

interface ActiveAuditStatus {
  hasSiteAudit: boolean
  hasPerformanceAudit: boolean
  hasAioAudit: boolean
}

export function useActiveAudit(organizationId?: string | null) {
  const [status, setStatus] = useState<ActiveAuditStatus>({
    hasSiteAudit: false,
    hasPerformanceAudit: false,
    hasAioAudit: false,
  })
  const [isLoading, setIsLoading] = useState(true)

  // Use ref to track the latest organizationId for the polling closure
  const orgIdRef = useRef(organizationId)

  // Track org changes to trigger re-poll
  const prevOrgIdRef = useRef(organizationId)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let isMounted = true

    const poll = async () => {
      try {
        // Build URL with optional org parameter
        const url = new URL('/api/audit/active', window.location.origin)
        if (orgIdRef.current) {
          url.searchParams.set('org', orgIdRef.current)
        }

        const response = await fetch(url.toString())
        if (response.ok && isMounted) {
          const data = await response.json()
          setStatus(data)
        } else if (!response.ok) {
          console.error('[Active Audit Polling Error]', {
            type: 'http_error',
            status: response.status,
            timestamp: new Date().toISOString(),
          })
        }
        if (isMounted) {
          setIsLoading(false)
          // Poll every 30 seconds to check for active audits
          // Reduced from 10s to avoid Supabase auth rate limits
          timeoutId = setTimeout(poll, 30000)
        }
      } catch (error) {
        console.error('[Active Audit Polling Error]', {
          type: 'fetch_error',
          error,
          timestamp: new Date().toISOString(),
        })
        if (isMounted) {
          setIsLoading(false)
          timeoutId = setTimeout(poll, 30000) // Retry after 30s on error
        }
      }
    }

    // Update ref for current org
    orgIdRef.current = organizationId

    // Check if org changed - if so, poll immediately
    const orgChanged = prevOrgIdRef.current !== organizationId
    prevOrgIdRef.current = organizationId

    if (orgChanged) {
      // Org changed, poll immediately
      poll()
    } else {
      // Initial mount or no change - start polling
      poll()
    }

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [organizationId])

  return { ...status, isLoading }
}
