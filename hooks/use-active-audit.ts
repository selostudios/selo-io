'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ActiveAuditStatus {
  hasSiteAudit: boolean
  hasPerformanceAudit: boolean
  hasAioAudit: boolean
}

const POLL_INTERVAL = 30000 // 30 seconds

export function useActiveAudit(organizationId?: string | null) {
  const [status, setStatus] = useState<ActiveAuditStatus>({
    hasSiteAudit: false,
    hasPerformanceAudit: false,
    hasAioAudit: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  // Refs for the polling closure
  const orgIdRef = useRef(organizationId)
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const startPollingLoopRef = useRef<() => Promise<void>>(async () => {})

  // Update org ref when it changes
  useEffect(() => {
    orgIdRef.current = organizationId
  }, [organizationId])

  // Core poll function
  const poll = useCallback(async (): Promise<boolean> => {
    try {
      const url = new URL('/api/audit/active', window.location.origin)
      if (orgIdRef.current) {
        url.searchParams.set('org', orgIdRef.current)
      }

      const response = await fetch(url.toString())
      if (response.ok && isMountedRef.current) {
        const data: ActiveAuditStatus = await response.json()
        setStatus(data)
        setIsLoading(false)

        // Return true if any audit is active (should continue polling)
        return data.hasSiteAudit || data.hasPerformanceAudit || data.hasAioAudit
      } else if (!response.ok) {
        console.error('[Active Audit Polling Error]', {
          type: 'http_error',
          status: response.status,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[Active Audit Polling Error]', {
        type: 'fetch_error',
        error,
        timestamp: new Date().toISOString(),
      })
    }

    if (isMountedRef.current) {
      setIsLoading(false)
    }
    return false
  }, [])

  // Start polling loop - continues until all audits are inactive
  const startPollingLoop = useCallback(async () => {
    if (!isMountedRef.current) return

    // Clear any existing timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }

    setIsPolling(true)
    const hasActive = await poll()

    if (hasActive && isMountedRef.current) {
      // Continue polling since there's an active audit
      timeoutIdRef.current = setTimeout(() => startPollingLoopRef.current(), POLL_INTERVAL)
    } else if (isMountedRef.current) {
      // No active audits, stop polling
      setIsPolling(false)
    }
  }, [poll])

  // Keep ref updated with latest function
  useEffect(() => {
    startPollingLoopRef.current = startPollingLoop
  }, [startPollingLoop])

  // Function to trigger polling (call this when starting an audit)
  const startPolling = useCallback(() => {
    if (!isPolling) {
      startPollingLoop()
    }
  }, [isPolling, startPollingLoop])

  // Initial check on mount and when org changes
  useEffect(() => {
    isMountedRef.current = true

    // Do initial check
    const initialCheck = async () => {
      const hasActive = await poll()
      if (hasActive && isMountedRef.current) {
        // Start polling loop if there are active audits
        startPollingLoop()
      }
    }

    initialCheck()

    return () => {
      isMountedRef.current = false
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }
  }, [organizationId, poll, startPollingLoop])

  // Listen for audit-started events to trigger polling
  useEffect(() => {
    const handleAuditStarted = () => {
      startPolling()
    }

    window.addEventListener('audit-started', handleAuditStarted)
    return () => window.removeEventListener('audit-started', handleAuditStarted)
  }, [startPolling])

  return { ...status, isLoading, isPolling, startPolling }
}

// Helper function to trigger polling from anywhere (call after starting an audit)
export function notifyAuditStarted() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('audit-started'))
  }
}
