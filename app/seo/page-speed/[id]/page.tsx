import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { getPerformanceAuditData } from './actions'
import { PerformanceResults } from '@/components/performance/performance-results'
import { PerformanceLiveProgress } from '@/components/performance/performance-live-progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDuration, calculateDuration } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PerformanceAuditResultsPage({ params }: Props) {
  const { id } = await params
  const { audit, results } = await getPerformanceAuditData(id)

  if (!audit) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/seo/page-speed"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Page Speed
        </Link>
        {audit.status === 'completed' && (
          <Button variant="outline" asChild>
            <a href={`/api/performance/${id}/export`} download>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </a>
          </Button>
        )}
      </div>

      {/* Show live progress for pending/running audits */}
      {audit.status === 'pending' || audit.status === 'running' ? (
        <PerformanceLiveProgress auditId={id} initialStatus={audit.status} />
      ) : (
        <>
          {/* Audit Info */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-balance">Performance Audit</h1>
              <Badge
                variant={
                  audit.status === 'completed'
                    ? 'success'
                    : audit.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {audit.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {audit.status === 'failed' ? 'Failed' : 'Audited'}{' '}
              {audit.completed_at ? formatDate(audit.completed_at, false) : 'In progress'} &middot;{' '}
              {audit.total_urls} page{audit.total_urls !== 1 ? 's' : ''} tested
              {(() => {
                const duration = calculateDuration(audit.started_at, audit.completed_at)
                return duration ? ` · ${formatDuration(duration)}` : ''
              })()}
            </p>
            {audit.error_message && (
              <p className="mt-2 text-sm text-red-600">{audit.error_message}</p>
            )}
          </div>

          {/* Results */}
          <PerformanceResults results={results} />
        </>
      )}
    </div>
  )
}
