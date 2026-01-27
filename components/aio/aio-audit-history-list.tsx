'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Clock, Sparkles, Loader2, Trash2, RefreshCw } from 'lucide-react'
import type { AIOAudit } from '@/lib/aio/types'
import { formatDuration, calculateDuration } from '@/lib/utils'
import { useState } from 'react'

interface AIOAuditHistoryListProps {
  audits: AIOAudit[]
  showUrl?: boolean
}

function formatAuditDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isInProgress(status: AIOAudit['status']): boolean {
  return status === 'pending' || status === 'running'
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function AIOAuditHistoryList({ audits, showUrl = false }: AIOAuditHistoryListProps) {
  const router = useRouter()
  const [refreshingAuditId, setRefreshingAuditId] = useState<string | null>(null)

  const handleDeleteAudit = async (auditId: string) => {
    try {
      const response = await fetch(`/api/aio/audit/${auditId}`, { method: 'DELETE' })
      if (response.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error('[AIO Audit History] Failed to delete audit:', err)
    }
  }

  const handleRefreshAudit = async (audit: AIOAudit) => {
    setRefreshingAuditId(audit.id)
    try {
      const response = await fetch('/api/aio/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: null,
          url: audit.url,
          sampleSize: audit.sample_size || 5,
        }),
      })

      if (!response.ok) {
        console.error('Failed to start audit')
        return
      }

      const data = await response.json()
      router.push(`/seo/aio/${data.auditId}`)
    } catch (error) {
      console.error('Failed to start audit:', error)
    } finally {
      setRefreshingAuditId(null)
    }
  }

  if (audits.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No AIO audits yet"
        description="Run your first AIO audit to analyze customer content for AI search engines."
      />
    )
  }

  return (
    <div className="divide-y">
      {audits.map((audit) => (
        <div key={audit.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-6">
            <span className="text-muted-foreground w-28 text-sm">
              {formatAuditDate(audit.created_at)}
            </span>
            {showUrl && (
              <span className="max-w-[200px] truncate text-sm font-medium">
                {getDomain(audit.url)}
              </span>
            )}
            {isInProgress(audit.status) ? (
              <div className="flex items-center gap-2">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                <Badge variant="outline">In Progress</Badge>
              </div>
            ) : audit.status === 'failed' ? (
              <Badge variant="destructive">Failed</Badge>
            ) : (
              <span className="font-medium tabular-nums">
                {audit.overall_aio_score !== null ? `${audit.overall_aio_score}/100` : '-'}
              </span>
            )}
            <span className="text-muted-foreground text-sm">
              {audit.pages_analyzed} {audit.pages_analyzed === 1 ? 'page' : 'pages'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {audit.status === 'completed' && (
              <div className="flex items-center gap-2">
                {audit.critical_recommendations && audit.critical_recommendations > 0 ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 tabular-nums">
                    {audit.critical_recommendations} critical
                  </span>
                ) : null}
                {audit.high_recommendations && audit.high_recommendations > 0 ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 tabular-nums">
                    {audit.high_recommendations} high
                  </span>
                ) : null}
              </div>
            )}
            {/* Show duration for completed audits */}
            {audit.status === 'completed' &&
            (() => {
              const duration = calculateDuration(audit.started_at, audit.completed_at)
              return duration ? (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3" />
                  {formatDuration(duration)}
                </span>
              ) : null
            })()}
            <Button asChild variant="outline" size="sm">
              <Link href={`/seo/aio/${audit.id}`}>View</Link>
            </Button>
            {showUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRefreshAudit(audit)}
                disabled={refreshingAuditId === audit.id || isInProgress(audit.status)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Re-run audit"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingAuditId === audit.id ? 'animate-spin' : ''}`} />
              </Button>
            )}
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
  )
}
