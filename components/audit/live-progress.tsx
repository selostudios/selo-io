'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuditPolling } from '@/hooks/use-audit-polling'
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
  const shouldPoll = initialStatus === 'pending' || initialStatus === 'crawling'

  const { progress, isLoading } = useAuditPolling(auditId, shouldPoll)

  // Auto-refresh when audit completes
  useEffect(() => {
    if (!progress) return

    const prevStatus = prevStatusRef.current
    prevStatusRef.current = progress.status

    // If status changed to completed, refresh the page to show full report
    if (progress.status === 'completed' && prevStatus !== 'completed') {
      router.refresh()
    }
  }, [progress, router])

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
      <div className="flex h-dvh items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 rounded-full bg-red-100 p-4">
              <XCircle className="size-8 text-red-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Audit Failed</h2>
            <p className="text-muted-foreground text-center text-sm">
              We encountered an error while auditing this website. Please try running the audit
              again.
            </p>
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
          <CardTitle className="text-xl">
            {status === 'pending' ? 'Starting Audit...' : 'Crawling Site...'}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {status === 'crawling'
              ? `Analyzing your website - ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} crawled`
              : 'Preparing to analyze your website'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Pages crawled counter */}
          <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
            <span className="text-muted-foreground text-sm font-medium">Pages Discovered</span>
            <span className="text-2xl font-bold tabular-nums">{pagesCrawled}</span>
          </div>

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
                      <span className="text-sm">{check.check_name}</span>
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
