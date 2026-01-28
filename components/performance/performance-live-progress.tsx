'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle, Clock, CheckCircle2, StopCircle, Smartphone, Monitor } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import { PerformanceAuditStatus } from '@/lib/enums'
import type { DeviceType } from '@/lib/performance/types'

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
  mobile_results_count: number
  desktop_results_count: number
}

export function PerformanceLiveProgress({ auditId, initialStatus }: PerformanceLiveProgressProps) {
  const router = useRouter()
  const prevStatusRef = useRef<PerformanceAuditStatus>(initialStatus)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)

  const shouldPoll = initialStatus === PerformanceAuditStatus.Pending || initialStatus === PerformanceAuditStatus.Running

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

    const terminalStatuses: PerformanceAuditStatus[] = [
      PerformanceAuditStatus.Completed,
      PerformanceAuditStatus.Failed,
      PerformanceAuditStatus.Stopped,
    ]
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
  if (progress?.status === PerformanceAuditStatus.Failed) {
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
  if (progress?.status === PerformanceAuditStatus.Stopped) {
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
  const mobileCount = progress?.mobile_results_count ?? 0
  const desktopCount = progress?.desktop_results_count ?? 0
  const mobileComplete = mobileCount >= totalUrls
  const desktopComplete = desktopCount >= totalUrls
  const currentUrl = progress?.current_url

  // Extract domain from URL for display
  const getDomain = (url: string): string => {
    try {
      const parsed = new URL(url)
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }

  // Get the title based on status and URL
  const getTitle = () => {
    if (progress?.status === PerformanceAuditStatus.Pending) {
      return 'Starting Audit...'
    }
    if (currentUrl) {
      return `Analyzing ${getDomain(currentUrl)}...`
    }
    return 'Analyzing Pages...'
  }

  // Determine what to show in the subtitle
  const getProgressSubtitle = () => {
    if (progress?.status === PerformanceAuditStatus.Pending) {
      return 'Initializing PageSpeed Insights...'
    }
    if (mobileComplete && desktopComplete) {
      return 'Finishing up...'
    }
    if (!mobileComplete && !desktopComplete) {
      return 'Auditing mobile & desktop versions'
    }
    if (!mobileComplete) {
      return 'Auditing mobile version'
    }
    return 'Auditing desktop version'
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Loader2 className="text-primary size-12 animate-spin" />
        </div>
        <CardTitle className="text-xl text-balance">{getTitle()}</CardTitle>
        <p className="text-muted-foreground text-sm text-pretty">{getProgressSubtitle()}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Device progress stats */}
        <div className="flex gap-3">
          <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
              <Smartphone className="size-4" />
              Mobile
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tabular-nums">
                {mobileCount}/{totalUrls}
              </span>
              {mobileComplete && <CheckCircle2 className="size-5 text-green-500" />}
            </div>
          </div>
          <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
              <Monitor className="size-4" />
              Desktop
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tabular-nums">
                {desktopCount}/{totalUrls}
              </span>
              {desktopComplete && <CheckCircle2 className="size-5 text-green-500" />}
            </div>
          </div>
        </div>

        {/* Elapsed time */}
        {elapsedMs > 0 && (
          <div className="flex justify-center">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Clock className="size-4" />
              Elapsed: {formatDuration(elapsedMs)}
            </span>
          </div>
        )}

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
