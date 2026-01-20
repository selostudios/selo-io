'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  StopCircle,
  Clock,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuditPolling } from '@/hooks/use-audit-polling'
import { formatDuration } from '@/lib/utils'
import type { AuditStatus, CheckStatus, CheckType } from '@/lib/audit/types'

interface LiveProgressProps {
  auditId: string
  initialStatus: AuditStatus
}

const checkTypeLabels: Record<CheckType, string> = {
  seo: 'SEO',
  ai_readiness: 'AI Readiness',
  technical: 'Technical',
}

const statusIcons: Record<CheckStatus, React.ReactNode> = {
  passed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  failed: <XCircle className="h-4 w-4 text-red-600" />,
  warning: <AlertCircle className="h-4 w-4 text-yellow-600" />,
}

export function LiveProgress({ auditId, initialStatus }: LiveProgressProps) {
  const router = useRouter()
  const prevStatusRef = useRef<AuditStatus>(initialStatus)
  const [isStopping, setIsStopping] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const shouldPoll =
    initialStatus === 'pending' || initialStatus === 'crawling' || initialStatus === 'checking'

  const { progress, isLoading } = useAuditPolling(auditId, shouldPoll)

  // Update elapsed time every second
  useEffect(() => {
    if (!progress?.started_at) return

    const startTime = new Date(progress.started_at).getTime()

    const updateElapsed = () => {
      setElapsedMs(Date.now() - startTime)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [progress?.started_at])

  // Auto-refresh when audit completes or stops
  useEffect(() => {
    if (!progress) return

    const prevStatus = prevStatusRef.current
    prevStatusRef.current = progress.status

    // If status changed to completed or stopped, refresh the page to show full report
    if (
      (progress.status === 'completed' || progress.status === 'stopped') &&
      prevStatus !== 'completed' &&
      prevStatus !== 'stopped'
    ) {
      router.refresh()
    }
  }, [progress, router])

  const handleStop = async () => {
    setIsStopping(true)
    try {
      const response = await fetch(`/api/audit/${auditId}/stop`, {
        method: 'POST',
      })
      if (!response.ok) {
        console.error('[Audit Stop Error]', {
          type: 'stop_request_failed',
          auditId,
          status: response.status,
          timestamp: new Date().toISOString(),
        })
      }
      // The polling will detect the status change and trigger a refresh
    } catch (error) {
      console.error('[Audit Stop Error]', {
        type: 'stop_request_error',
        auditId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
      setIsStopping(false)
    }
  }

  // Show loading state while fetching initial data
  if (isLoading && shouldPoll) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="text-primary mb-4 size-12 animate-spin" />
            <h2 className="mb-2 text-xl font-semibold">Loading Audit Status...</h2>
            <p className="text-muted-foreground text-sm">Please wait</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show failed state
  if (progress?.status === 'failed') {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 rounded-full bg-red-100 p-4">
              <XCircle className="size-8 text-red-600" />
            </div>
            <h2 className="mb-2 text-center text-xl font-semibold text-balance">Audit Failed</h2>
            <p className="text-muted-foreground mb-4 text-center text-sm text-pretty">
              We encountered an error while auditing this website.
            </p>
            {progress.error_message && (
              <div className="bg-muted/50 w-full rounded-lg p-3">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Error Details
                </p>
                <p className="mt-1 text-sm">{progress.error_message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get recent checks (last 10) for display
  const recentChecks = progress?.checks?.slice(0, 10) ?? []
  const pagesCrawled = progress?.pages_crawled ?? 0
  const status = progress?.status ?? initialStatus

  return (
    <div className="flex h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Loader2 className="text-primary size-12 animate-spin" />
          </div>
          <CardTitle className="text-xl text-balance">
            {status === 'pending'
              ? 'Starting Audit...'
              : status === 'checking'
                ? 'Running Checks...'
                : 'Crawling Site...'}
          </CardTitle>
          <p className="text-muted-foreground text-sm text-pretty">
            {status === 'checking'
              ? `Analyzing ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} for SEO and AI readiness`
              : status === 'crawling'
                ? `Discovering pages - ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} found`
                : 'Preparing to analyze your website'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="flex gap-3">
            <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                <FileText className="size-4" />
                Pages Found
              </span>
              <span className="text-2xl font-bold tabular-nums">{pagesCrawled}</span>
            </div>
            {elapsedMs > 0 && (
              <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="size-4" />
                  Elapsed
                </span>
                <span className="text-2xl font-bold tabular-nums">{formatDuration(elapsedMs)}</span>
              </div>
            )}
          </div>

          {/* Stop button */}
          {pagesCrawled > 0 && (
            <Button variant="outline" className="w-full" onClick={handleStop} disabled={isStopping}>
              {isStopping ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <StopCircle className="mr-2 size-4" />
                  Stop &amp; Generate Report
                </>
              )}
            </Button>
          )}

          {/* Recent checks */}
          {recentChecks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Recent Checks
              </h3>
              <div className="space-y-1">
                {recentChecks.map((check, index) => (
                  <div
                    key={`${check.check_name}-${index}`}
                    className="bg-muted/30 flex items-center justify-between rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {statusIcons[check.status]}
                      <span className="text-sm">
                        {check.display_name || check.check_name.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {checkTypeLabels[check.check_type]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Helpful text */}
          <p className="text-muted-foreground text-center text-xs">
            This page will automatically update when the audit is complete.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
