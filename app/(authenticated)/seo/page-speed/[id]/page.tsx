import { getPerformanceAuditData } from './actions'
import { PerformanceAuditPage } from '@/components/performance/performance-audit-page'
import { PerformanceLiveProgress } from '@/components/performance/performance-live-progress'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PerformanceAuditResultsPage({ params }: Props) {
  const { id } = await params
  const { audit, results } = await getPerformanceAuditData(id)

  // Show live progress for pending/running audits
  if (audit.status === 'pending' || audit.status === 'running') {
    return (
      <div className="mx-auto max-w-5xl">
        <PerformanceLiveProgress auditId={id} initialStatus={audit.status} />
      </div>
    )
  }

  return <PerformanceAuditPage id={id} audit={audit} results={results} />
}
