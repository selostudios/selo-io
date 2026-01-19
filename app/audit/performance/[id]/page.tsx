import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPerformanceAuditData } from './actions'
import { PerformanceResults } from '@/components/performance/performance-results'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

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
          href="/audit/performance"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Performance Audits
        </Link>
      </div>

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
          {audit.completed_at
            ? `Completed ${formatDate(audit.completed_at, false)}`
            : audit.started_at
              ? `Started ${formatDate(audit.started_at, false)}`
              : `Created ${formatDate(audit.created_at, false)}`}
        </p>
        {audit.error_message && (
          <p className="mt-2 text-sm text-red-600">{audit.error_message}</p>
        )}
      </div>

      {/* Results */}
      <PerformanceResults results={results} />
    </div>
  )
}
