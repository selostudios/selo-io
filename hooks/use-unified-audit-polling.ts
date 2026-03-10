'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { UnifiedAuditStatus } from '@/lib/enums'

interface UnifiedAuditProgress {
  id: string
  status: string
  url: string
  crawl_mode: string
  pages_crawled: number
  overall_score: number | null
  seo_score: number | null
  performance_score: number | null
  ai_readiness_score: number | null
  failed_count: number
  warning_count: number
  passed_count: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  progress: {
    phase: string
    crawl: { status: string; pagesCrawled: number; maxPages: number }
    analysis: {
      checks: { status: string; completed: number; total: number }
      psi: { status: string; completed: number; total: number }
      ai: { status: string; completed: number; total: number }
    }
    scoring: { status: string }
  }
}

export function useUnifiedAuditPolling(auditId: string, enabled: boolean) {
  const [progress, setProgress] = useState<UnifiedAuditProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isContinuing, setIsContinuing] = useState(false)
  const isContinuingRef = useRef(false)

  const triggerContinue = useCallback(async () => {
    if (isContinuingRef.current) return
    isContinuingRef.current = true
    setIsContinuing(true)

    try {
      const response = await fetch(`/api/unified-audit/${auditId}/continue`, {
        method: 'POST',
      })
      if (!response.ok) {
        console.error('[Unified Audit Continue Error]', {
          type: 'continue_request_failed',
          auditId,
          status: response.status,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[Unified Audit Continue Error]', {
        type: 'continue_request_error',
        auditId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    } finally {
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
        const response = await fetch(`/api/unified-audit/${auditId}/status`)
        const data = await response.json()
        setProgress(data)
        setIsLoading(false)

        // Auto-trigger continuation for batch_complete
        if (data.status === UnifiedAuditStatus.BatchComplete && !isContinuingRef.current) {
          triggerContinue()
          timeoutId = setTimeout(poll, 2000)
          return
        }

        // Continue polling if not in a terminal state
        if (
          data.status === UnifiedAuditStatus.Pending ||
          data.status === UnifiedAuditStatus.Crawling ||
          data.status === UnifiedAuditStatus.Checking ||
          data.status === UnifiedAuditStatus.BatchComplete ||
          data.status === UnifiedAuditStatus.AwaitingConfirmation
        ) {
          timeoutId = setTimeout(poll, 2000)
        }
      } catch {
        console.error('[Unified Audit Polling Error]', {
          type: 'fetch_error',
          auditId,
          timestamp: new Date().toISOString(),
        })
        timeoutId = setTimeout(poll, 5000)
      }
    }

    poll()

    return () => clearTimeout(timeoutId)
  }, [auditId, enabled, triggerContinue])

  return { progress, isLoading, isContinuing }
}
