import { getGEOAuditReport } from './actions'
import { GEOAuditReport } from '@/components/geo/geo-audit-report'
import { GEOLiveProgress } from '@/components/geo/geo-live-progress'

interface GEOAuditReportPageProps {
  params: Promise<{ id: string }>
}

export default async function GEOAuditReportPage({ params }: GEOAuditReportPageProps) {
  const { id } = await params
  const { audit, checks, aiAnalyses } = await getGEOAuditReport(id)

  // Show progress view for in-progress audits
  if (audit.status === 'pending' || audit.status === 'running') {
    return <GEOLiveProgress auditId={audit.id} initialStatus={audit.status} />
  }

  return <GEOAuditReport audit={audit} checks={checks} aiAnalyses={aiAnalyses} />
}
