import { getAIOAuditReport } from './actions'
import { AIOAuditReport } from '@/components/aio/aio-audit-report'
import { AIOLiveProgress } from '@/components/aio/aio-live-progress'

interface AIOAuditReportPageProps {
  params: Promise<{ id: string }>
}

export default async function AIOAuditReportPage({ params }: AIOAuditReportPageProps) {
  const { id } = await params
  const { audit, checks, aiAnalyses } = await getAIOAuditReport(id)

  // Show progress view for in-progress audits
  if (audit.status === 'pending' || audit.status === 'running') {
    return <AIOLiveProgress auditId={audit.id} initialStatus={audit.status} />
  }

  return <AIOAuditReport audit={audit} checks={checks} aiAnalyses={aiAnalyses} />
}
