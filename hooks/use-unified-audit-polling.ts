'use client'

import { useState, useRef, useCallback } from 'react'
import { UnifiedAuditStatus } from '@/lib/enums'
import { usePolling } from './use-polling'

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

const TERMINAL_STATUSES = new Set([
  UnifiedAuditStatus.Completed,
  UnifiedAuditStatus.CompletedWithErrors,
  UnifiedAuditStatus.Failed,
  UnifiedAuditStatus.Stopped,
])

export function useUnifiedAuditPolling(auditId: string, enabled: boolean) {
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

  const fetcher = useCallback(async (): Promise<UnifiedAuditProgress> => {
    try {
      const response = await fetch(`/api/unified-audit/${auditId}/status`)
      const data = await response.json()

      // Trigger batch continuation if needed (side effect during fetch)
      if (data.status === UnifiedAuditStatus.BatchComplete && !isContinuingRef.current) {
        triggerContinue()
      }

      return data
    } catch (error) {
      console.error('[Unified Audit Polling Error]', {
        type: 'fetch_error',
        auditId,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }, [auditId, triggerContinue])

  const { data: progress, isLoading } = usePolling<UnifiedAuditProgress>({
    fetcher,
    enabled,
    intervalMs: 2000,
    errorIntervalMs: 5000,
    isComplete: (data) => TERMINAL_STATUSES.has(data.status as UnifiedAuditStatus),
  })

  return { progress, isLoading, isContinuing }
}
