'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle, Clock, Globe, CheckCircle2, StopCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import type { PerformanceAuditStatus, DeviceType } from '@/lib/performance/types'

interface PerformanceLiveProgressProps {
  auditId: string
  initialStatus: PerformanceAuditStatus
}

interface ProgressData {
  status: PerformanceAuditStatus
  current_url: string | null
  current_device: DeviceType | null
  total_urls: number
  completed_count: number
  started_at: string | null
  error_message: string | null
  results_count: number
}

export function PerformanceLiveProgress({ auditId, initialStatus }: PerformanceLiveProgressProps) {
  const router = useRouter()
  const prevStatusRef = useRef<PerformanceAuditStatus>(initialStatus)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)

  const shouldPoll = initialStatus === 'pending' || initialStatus === 'running'

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const response = await fetch(`/api/performance/${auditId}/stop`, {
        method: 'POST',
      })
      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('[Performance] Failed to cancel audit:', error)
    } finally {
      setIsCancelling(false)
    }
  }

  // Poll for progress
  useEffect(() => {
    if (!shouldPoll) return

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/performance/${auditId}/progress`)
        if (response.ok) {
          const data = await response.json()
          setProgress(data)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[Performance Progress] Failed to fetch progress:', error)
      }
    }

    fetchProgress()
    const interval = setInterval(fetchProgress, 2000)

    return () => clearInterval(interval)
  }, [auditId, shouldPoll])

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

  // Auto-refresh when audit completes
  useEffect(() => {
    if (!progress) return

    const prevStatus = prevStatusRef.current
    prevStatusRef.current = progress.status

    const terminalStatuses: PerformanceAuditStatus[] = ['completed', 'failed', 'stopped']
    if (terminalStatuses.includes(progress.status) && !terminalStatuses.includes(prevStatus)) {
      router.refresh()
    }
  }, [progress, router])

  // Show loading state while fetching initial data
  if (isLoading && shouldPoll) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="text-primary mb-4 size-12 animate-spin" />
          <h2 className="mb-2 text-xl font-semibold">Loading Audit Status...</h2>
          <p className="text-muted-foreground text-sm">Please wait</p>
        </CardContent>
      </Card>
    )
  }

  // Show failed state
  if (progress?.status === 'failed') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <div className="mb-4 rounded-full bg-red-100 p-4">
            <XCircle className="size-8 text-red-600" />
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold text-balance">Audit Failed</h2>
          <p className="text-muted-foreground mb-4 text-center text-sm text-pretty">
            We encountered an error while running the performance audit.
          </p>
          {progress.error_message && (
            <div className="bg-muted/50 w-full max-w-md rounded-lg p-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Error Details
              </p>
              <p className="mt-1 text-sm">{progress.error_message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Show stopped state
  if (progress?.status === 'stopped') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <div className="mb-4 rounded-full bg-amber-100 p-4">
            <StopCircle className="size-8 text-amber-600" />
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold text-balance">Audit Cancelled</h2>
          <p className="text-muted-foreground text-center text-sm text-pretty">
            The performance audit was cancelled. No results were saved.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalUrls = progress?.total_urls ?? 0
  const completedCount = progress?.completed_count ?? 0
  const currentUrl = progress?.current_url
  const currentDevice = progress?.current_device
  const progressPercent = totalUrls > 0 ? Math.round((completedCount / totalUrls) * 100) : 0

  // Extract pathname from URL for display
  const getPathname = (url: string): string => {
    try {
      const parsed = new URL(url)
      return parsed.pathname || '/'
    } catch {
      return url
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Loader2 className="text-primary size-12 animate-spin" />
        </div>
        <CardTitle className="text-xl text-balance">
          {progress?.status === 'pending' ? 'Starting Audit...' : 'Analyzing Pages...'}
        </CardTitle>
        <p className="text-muted-foreground text-sm text-pretty">
          Testing {totalUrls} page{totalUrls !== 1 ? 's' : ''} with PageSpeed Insights
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">
              {completedCount} / {totalUrls} pages
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Current URL being audited */}
        {currentUrl && (
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Currently Auditing
            </p>
            <div className="flex items-center gap-2">
              <Globe className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate font-medium">{getPathname(currentUrl)}</span>
              {currentDevice && (
                <span className="text-muted-foreground shrink-0 text-sm">({currentDevice})</span>
              )}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 className="size-4" />
              Completed
            </span>
            <span className="text-2xl font-bold tabular-nums">{completedCount}</span>
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

        {/* Helpful text */}
        <p className="text-muted-foreground text-center text-xs">
          This page will automatically update when the audit is complete.
        </p>

        {/* Cancel button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isCancelling}
            className="text-muted-foreground"
          >
            {isCancelling ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <StopCircle className="mr-2 size-4" />
                Cancel Audit
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
