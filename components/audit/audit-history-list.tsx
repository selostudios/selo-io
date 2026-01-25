'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Clock, FileSearch, Loader2, Trash2 } from 'lucide-react'
import type { SiteAudit } from '@/lib/audit/types'
import { formatDuration, calculateDuration } from '@/lib/utils'

interface AuditHistoryListProps {
  audits: SiteAudit[]
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

function isInProgress(status: SiteAudit['status']): boolean {
  return status === 'pending' || status === 'crawling'
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function AuditHistoryList({ audits, showUrl = false }: AuditHistoryListProps) {
  const router = useRouter()

  const handleDeleteAudit = async (auditId: string) => {
    try {
      const response = await fetch(`/api/audit/${auditId}`, { method: 'DELETE' })
      if (response.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error('[Audit History] Failed to delete audit:', err)
    }
  }

  if (audits.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No audits yet"
        description="Run your first audit to get started."
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
                {audit.overall_score !== null ? `${audit.overall_score}/100` : '-'}
              </span>
            )}
            <span className="text-muted-foreground text-sm">
              {audit.pages_crawled} {audit.pages_crawled === 1 ? 'page' : 'pages'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Show pills for completed, stopped, or failed audits that have check counts */}
            {(audit.status === 'completed' ||
              audit.status === 'stopped' ||
              audit.status === 'failed') &&
            (audit.failed_count > 0 || audit.warning_count > 0 || audit.passed_count > 0) ? (
              <>
                <div className="flex items-center gap-2 text-xs">
                  {audit.failed_count > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 tabular-nums">
                      {audit.failed_count} failed
                    </span>
                  )}
                  {audit.warning_count > 0 && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700 tabular-nums">
                      {audit.warning_count} warnings
                    </span>
                  )}
                  {audit.passed_count > 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 tabular-nums">
                      {audit.passed_count} passed
                    </span>
                  )}
                </div>
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
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={`/seo/site-audit/${audit.id}`}>View</Link>
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
  )
}
