'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckItem } from '@/components/audit/check-item'
import { useAIOAuditPolling } from '@/hooks/use-aio-audit-polling'
import type { SiteAuditCheck } from '@/lib/audit/types'

interface AIOLiveProgressProps {
  auditId: string
  initialStatus: 'pending' | 'running'
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function AIOLiveProgress({ auditId, initialStatus }: AIOLiveProgressProps) {
  const router = useRouter()
  const { audit, checks } = useAIOAuditPolling(auditId)

  // Redirect when complete
  useEffect(() => {
    if (audit && (audit.status === 'completed' || audit.status === 'failed')) {
      // Refresh the page to show results
      router.refresh()
    }
  }, [audit, router])

  const currentStatus = audit?.status ?? initialStatus

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AIO Audit in Progress</h1>
        <p className="text-muted-foreground">
          Analyzing {audit?.url ? getDomain(audit.url) : 'website'} for AI search optimization
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2
              className="h-5 w-5 text-neutral-400 motion-safe:animate-spin"
              aria-hidden="true"
            />
            {currentStatus === 'pending' && 'Starting Audit…'}
            {currentStatus === 'running' && 'Running Analysis…'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {currentStatus === 'pending' && 'Initializing audit system…'}
                {currentStatus === 'running' && checks.length > 0
                  ? 'Analyzing technical foundation and content quality…'
                  : 'Starting programmatic checks…'}
              </span>
              {checks.length > 0 && (
                <span className="font-medium">
                  {checks.length} {checks.length === 1 ? 'check' : 'checks'} completed
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checks as they complete */}
      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checks.map((check) => (
              <CheckItem
                key={check.id}
                check={
                  {
                    id: check.id,
                    audit_id: check.audit_id,
                    page_id: null,
                    check_type: 'ai_readiness',
                    check_name: check.check_name,
                    priority: check.priority,
                    status: check.status,
                    display_name: check.display_name ?? check.check_name,
                    display_name_passed:
                      check.display_name_passed ?? check.display_name ?? check.check_name,
                    details: check.details,
                    learn_more_url: check.learn_more_url ?? undefined,
                    created_at: check.created_at,
                  } as SiteAuditCheck
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
