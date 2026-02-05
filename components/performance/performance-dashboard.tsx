'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, Gauge, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditRunControl } from '@/components/audit/audit-run-control'
import type { PerformanceAudit } from '@/lib/performance/types'
import { formatDuration, calculateDuration } from '@/lib/utils'
import { notifyAuditStarted } from '@/hooks/use-active-audit'

function formatAuditDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isInProgress(status: PerformanceAudit['status']): boolean {
  return status === 'pending' || status === 'running'
}

interface PerformanceDashboardProps {
  audits: PerformanceAudit[]
  websiteUrl: string
  organizationId?: string
}

export function PerformanceDashboard({
  audits,
  websiteUrl,
  organizationId,
}: PerformanceDashboardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleRunAudit = async (url: string, orgId?: string) => {
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          const response = await fetch('/api/performance/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [url], organizationId: orgId }),
          })

          if (!response.ok) {
            const data = await response.json()
            reject(new Error(data.error || 'Failed to start audit'))
            return
          }

          const data = await response.json()
          notifyAuditStarted()
          router.push(`/seo/page-speed/${data.auditId}`)
          resolve()
        } catch (err) {
          console.error('[Performance Dashboard] Failed to start audit:', err)
          reject(err instanceof Error ? err : new Error('Failed to start audit'))
        }
      })
    })
  }

  const handleDeleteAudit = async (auditId: string) => {
    try {
      const response = await fetch(`/api/performance/${auditId}`, { method: 'DELETE' })
      if (response.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error('[Performance Dashboard] Failed to delete audit:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Run Audit Card */}
      <AuditRunControl
        title="Run Performance Audit"
        description="Test 1 page with PageSpeed Insights"
        organization={organizationId ? { id: organizationId, websiteUrl } : null}
        onRunAudit={handleRunAudit}
        isRunning={isPending}
      />

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <EmptyState
              icon={Gauge}
              title="No audits yet"
              description="Run your first performance audit above."
            />
          ) : (
            <div className="divide-y">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground w-28 text-sm">
                      {formatAuditDate(audit.created_at)}
                    </span>
                    {audit.organization_id === null && (audit.first_url || audit.current_url) && (
                      <span className="max-w-[300px] truncate text-sm font-medium">
                        {audit.first_url || audit.current_url}
                      </span>
                    )}
                    {isInProgress(audit.status) ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="text-muted-foreground h-4 w-4 motion-safe:animate-spin" />
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                          In Progress
                        </span>
                      </div>
                    ) : audit.status === 'failed' ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Failed
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {audit.total_urls
                          ? `${audit.total_urls} ${audit.total_urls === 1 ? 'page' : 'pages'}`
                          : '-'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {audit.status === 'completed' && (
                      <>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Completed
                        </span>
                        {(() => {
                          const duration = calculateDuration(audit.started_at, audit.completed_at)
                          return duration ? (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Clock className="size-3" />
                              {formatDuration(duration)}
                            </span>
                          ) : null
                        })()}
                      </>
                    )}
                    {audit.status === 'stopped' && (
                      <>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          Stopped
                        </span>
                        {(() => {
                          const duration = calculateDuration(audit.started_at, audit.completed_at)
                          return duration ? (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Clock className="size-3" />
                              {formatDuration(duration)}
                            </span>
                          ) : null
                        })()}
                      </>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/seo/page-speed/${audit.id}`}>View</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAudit(audit.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete audit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
