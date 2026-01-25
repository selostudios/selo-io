'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  StopCircle,
  Clock,
  FileText,
  Bell,
  BellOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuditPolling } from '@/hooks/use-audit-polling'
import { formatDuration } from '@/lib/utils'
import type { AuditStatus, CheckStatus, CheckType } from '@/lib/audit/types'

type NotificationPermission = 'default' | 'granted' | 'denied'

interface LiveProgressProps {
  auditId: string
  initialStatus: AuditStatus
}

const checkTypeLabels: Record<CheckType, string> = {
  seo: 'SEO',
  ai_readiness: 'AI Readiness',
  technical: 'Technical',
}

function getDomain(url: string | undefined): string {
  if (!url) return 'site'
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
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
  const [isResuming, setIsResuming] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default')
  const shouldPoll =
    initialStatus === 'pending' || initialStatus === 'crawling' || initialStatus === 'checking'

  const { progress, isLoading } = useAuditPolling(auditId, shouldPoll)

  const [supportsNotifications, setSupportsNotifications] = useState(false)

  // Check notification support and permission on mount
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
      console.error('[Notification Error] Failed to request permission')
    }
  }, [])

  const showNotification = useCallback(
    (title: string, body: string) => {
      if (notificationPermission !== 'granted') return
      if (typeof window === 'undefined' || !('Notification' in window)) return

      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `audit-${auditId}`, // Prevents duplicate notifications
        })
      } catch {
        console.error('[Notification Error] Failed to show notification')
      }
    },
    [auditId, notificationPermission]
  )

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

  // Auto-refresh when audit completes or stops, and show notification
  useEffect(() => {
    if (!progress) return

    const prevStatus = prevStatusRef.current
    prevStatusRef.current = progress.status

    // If status changed to completed or stopped, show notification and refresh
    if (
      (progress.status === 'completed' || progress.status === 'stopped') &&
      prevStatus !== 'completed' &&
      prevStatus !== 'stopped'
    ) {
      const pageCount = progress.pages_crawled ?? 0
      showNotification(
        'Audit Complete',
        `Your site audit is ready. ${pageCount} page${pageCount !== 1 ? 's' : ''} analyzed.`
      )
      router.refresh()
    }
  }, [progress, router, showNotification])

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

  const handleResume = async () => {
    setIsResuming(true)
    try {
      const response = await fetch(`/api/audit/${auditId}/resume`, {
        method: 'POST',
      })
      if (response.ok) {
        // Refresh the page to show the checking progress
        router.refresh()
      } else {
        const data = await response.json()
        console.error('[Audit Resume Error]', data.error)
        setIsResuming(false)
      }
    } catch (error) {
      console.error('[Audit Resume Error]', error)
      setIsResuming(false)
    }
  }

  // Show loading state while fetching initial data
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

  // Show failed state
  if (progress?.status === 'failed') {
    const canResume = (progress.pages_crawled ?? 0) > 0

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
            {canResume && (
              <div className="w-full space-y-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-sm">
                    <span className="font-medium">{progress.pages_crawled}</span>{' '}
                    <span className="text-muted-foreground">
                      page{progress.pages_crawled !== 1 ? 's were' : ' was'} crawled before the
                      failure
                    </span>
                  </p>
                </div>
                <Button className="w-full" onClick={handleResume} disabled={isResuming}>
                  {isResuming ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 size-4" />
                      Run Checks on {progress.pages_crawled} Page
                      {progress.pages_crawled !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
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

  // Phase indicator helper
  const phases = [
    { key: 'pending', label: 'Starting' },
    { key: 'crawling', label: 'Crawling' },
    { key: 'checking', label: 'Analyzing' },
  ]
  const currentPhaseIndex = phases.findIndex((p) => p.key === status)

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
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
            {status === 'pending'
              ? 'Starting Audit...'
              : status === 'checking'
                ? 'Running Checks...'
                : `Crawling ${getDomain(progress?.url)}...`}
          </CardTitle>
          <p className="text-muted-foreground text-sm text-pretty">
            {status === 'checking'
              ? `Analyzing ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} for SEO and AI readiness`
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

          {/* Stop button - always show for in-progress audits */}
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

          {/* Helpful text */}
          <p className="text-muted-foreground text-center text-xs">
            This page will automatically update when the audit is complete.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
