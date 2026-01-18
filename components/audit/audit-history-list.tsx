import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { SiteAudit } from '@/lib/audit/types'

interface AuditHistoryListProps {
  audits: SiteAudit[]
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

export function AuditHistoryList({ audits }: AuditHistoryListProps) {
  if (audits.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center">
        No audits yet. Run your first audit to get started.
      </div>
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
            {isInProgress(audit.status) ? (
              <div className="flex items-center gap-2">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                <Badge variant="outline">In Progress</Badge>
              </div>
            ) : audit.status === 'failed' ? (
              <Badge variant="destructive">Failed</Badge>
            ) : (
              <span className="font-medium">
                {audit.overall_score !== null ? `${audit.overall_score}/100` : '-'}
              </span>
            )}
            <span className="text-muted-foreground text-sm">
              {audit.pages_crawled} {audit.pages_crawled === 1 ? 'page' : 'pages'}
            </span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/audit/${audit.id}`}>View</Link>
          </Button>
        </div>
      ))}
    </div>
  )
}
