'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  StopCircle,
  Clock,
  FileText,
  Bell,
  BellOff,
  PlayCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUnifiedAuditPolling } from '@/hooks/use-unified-audit-polling'
import { formatDuration, getDomain } from '@/lib/utils'
import { UnifiedAuditStatus } from '@/lib/enums'

type NotificationPermission = 'default' | 'granted' | 'denied'

interface UnifiedLiveProgressProps {
  auditId: string
  initialStatus: string
}

const checkDescriptions = [
  'Analyzing page structure...',
  'Checking meta tags...',
  'Validating heading hierarchy...',
  'Scanning for broken links...',
  'Reviewing schema markup...',
  'Inspecting image optimization...',
  'Evaluating AI readiness...',
  'Checking page performance...',
]

export function UnifiedLiveProgress({ auditId, initialStatus }: UnifiedLiveProgressProps) {
  const router = useRouter()
  const prevStatusRef = useRef(initialStatus)
  const [isStopping, setIsStopping] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default')

  const shouldPoll =
    initialStatus === UnifiedAuditStatus.Pending ||
    initialStatus === UnifiedAuditStatus.Crawling ||
    initialStatus === UnifiedAuditStatus.Checking ||
    initialStatus === UnifiedAuditStatus.BatchComplete ||
    initialStatus === UnifiedAuditStatus.AwaitingConfirmation

  const { progress, isLoading, isContinuing } = useUnifiedAuditPolling(auditId, shouldPoll)

  // Rotating descriptions
  const [descIndex, setDescIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setDescIndex((i) => (i + 1) % checkDescriptions.length)
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const [supportsNotifications, setSupportsNotifications] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrating client-only state on mount
      setSupportsNotifications(true)
      setNotificationPermission(Notification.permission as NotificationPermission)
    }
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission as NotificationPermission)
    } catch {
      // Silently fail
    }
  }, [])

  const showNotification = useCallback(
    (title: string, body: string) => {
      if (notificationPermission !== 'granted') return
      if (typeof window === 'undefined' || !('Notification' in window)) return
      try {
        new Notification(title, { body, icon: '/favicon.ico', tag: `audit-${auditId}` })
      } catch {
        // Silently fail
      }
    },
    [auditId, notificationPermission]
  )

  // Elapsed timer
  useEffect(() => {
    if (!progress?.started_at) return
    const startTime = new Date(progress.started_at).getTime()
    const updateElapsed = () => setElapsedMs(Date.now() - startTime)
    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [progress?.started_at])

  // Auto-refresh on completion
  useEffect(() => {
    if (!progress) return
    const prevStatus = prevStatusRef.current
    prevStatusRef.current = progress.status

    if (
      (progress.status === UnifiedAuditStatus.Completed ||
        progress.status === UnifiedAuditStatus.Stopped) &&
      prevStatus !== UnifiedAuditStatus.Completed &&
      prevStatus !== UnifiedAuditStatus.Stopped
    ) {
      const pageCount = progress.pages_crawled ?? 0
      showNotification(
        'Audit Complete',
        `Your audit is ready. ${pageCount} page${pageCount !== 1 ? 's' : ''} analyzed.`
      )
      router.refresh()
    }
  }, [progress, router, showNotification])

  const handleStop = async () => {
    setIsStopping(true)
    try {
      const response = await fetch(`/api/unified-audit/${auditId}/stop`, { method: 'POST' })
      if (!response.ok) {
        console.error('[Unified Audit Stop Error]', {
          type: 'stop_request_failed',
          auditId,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[Unified Audit Stop Error]', {
        type: 'stop_request_error',
        auditId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
      setIsStopping(false)
    }
  }

  const handleConfirmContinue = async () => {
    setIsConfirming(true)
    try {
      const response = await fetch(`/api/unified-audit/${auditId}/confirm-continue`, {
        method: 'POST',
      })
      if (response.ok) {
        router.refresh()
      } else {
        setIsConfirming(false)
      }
    } catch {
      setIsConfirming(false)
    }
  }

  if (isLoading && shouldPoll) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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

  // Failed state
  if (progress?.status === UnifiedAuditStatus.Failed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
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
              <div className="bg-muted/50 mb-4 w-full rounded-lg p-3">
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

  // Awaiting confirmation state (exhaustive mode soft cap)
  if (progress?.status === UnifiedAuditStatus.AwaitingConfirmation) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 rounded-full bg-yellow-100 p-4">
              <FileText className="size-8 text-yellow-600" />
            </div>
            <h2 className="mb-2 text-center text-xl font-semibold text-balance">
              Soft Cap Reached
            </h2>
            <p className="text-muted-foreground mb-4 text-center text-sm text-pretty">
              We&apos;ve crawled {progress.pages_crawled} pages. Would you like to continue crawling
              or generate the report with current data?
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <StopCircle className="mr-2 size-4" />
                    Generate Report
                  </>
                )}
              </Button>
              <Button className="flex-1" onClick={handleConfirmContinue} disabled={isConfirming}>
                {isConfirming ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Continuing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 size-4" />
                    Continue Crawling
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pagesCrawled = progress?.pages_crawled ?? 0
  const status = progress?.status ?? initialStatus

  // Phase indicator
  const phases = [
    { key: UnifiedAuditStatus.Pending, label: 'Starting' },
    { key: UnifiedAuditStatus.Crawling, label: 'Crawling' },
    { key: UnifiedAuditStatus.Checking, label: 'Analyzing' },
  ]
  const effectiveStatus =
    status === UnifiedAuditStatus.BatchComplete ? UnifiedAuditStatus.Crawling : status
  const currentPhaseIndex = phases.findIndex((p) => p.key === effectiveStatus)

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4" data-testid="audit-progress">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          {/* Phase indicator */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {phases.map((phase, index) => (
              <div key={phase.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                      index < currentPhaseIndex
                        ? 'bg-green-100 text-green-700'
                        : index === currentPhaseIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index < currentPhaseIndex ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : index === currentPhaseIndex ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`mt-1 text-xs ${index === currentPhaseIndex ? 'font-medium' : 'text-muted-foreground'}`}
                  >
                    {phase.label}
                  </span>
                </div>
                {index < phases.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-8 ${
                      index < currentPhaseIndex ? 'bg-green-200' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <CardTitle className="text-xl text-balance">
            {status === UnifiedAuditStatus.Pending
              ? 'Starting Audit...'
              : status === UnifiedAuditStatus.Checking
                ? 'Running Checks...'
                : status === UnifiedAuditStatus.BatchComplete || isContinuing
                  ? 'Continuing...'
                  : `Crawling ${getDomain(progress?.url, 'site')}...`}
          </CardTitle>
          <p className="text-muted-foreground text-sm text-pretty transition-opacity duration-300">
            {status === UnifiedAuditStatus.Checking
              ? `Analyzing ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} across 10 categories`
              : status === UnifiedAuditStatus.BatchComplete || isContinuing
                ? 'Starting next batch...'
                : checkDescriptions[descIndex]}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="flex gap-3">
            <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                <FileText className="size-4" />
                Pages Crawled
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
          <Button variant="outline" className="w-full" onClick={handleStop} disabled={isStopping}>
            {isStopping ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <StopCircle className="mr-2 size-4" />
                {pagesCrawled > 0 ? 'Stop & Generate Report' : 'Cancel Audit'}
              </>
            )}
          </Button>

          {/* Notification toggle */}
          {supportsNotifications && (
            <div className="flex items-center justify-center gap-2">
              {notificationPermission === 'granted' ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Bell className="size-3" />
                  You&apos;ll be notified when the audit is complete
                </p>
              ) : notificationPermission === 'denied' ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <BellOff className="size-3" />
                  Notifications are blocked
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto py-1 text-xs"
                  onClick={requestNotificationPermission}
                >
                  <Bell className="mr-1.5 size-3" />
                  Enable notifications
                </Button>
              )}
            </div>
          )}

          <p className="text-muted-foreground text-center text-xs">
            The audit runs in the background. You can close this tab and come back later.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
