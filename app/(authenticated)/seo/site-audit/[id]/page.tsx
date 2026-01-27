import { getAuditReport } from './actions'
import { AuditReport } from '@/components/audit/audit-report'
import { LiveProgress } from '@/components/audit/live-progress'

interface AuditReportPageProps {
  params: Promise<{ id: string }>
}

export default async function AuditReportPage({ params }: AuditReportPageProps) {
  const { id } = await params
  const { audit, checks, pages } = await getAuditReport(id)

  // Show progress view for in-progress audits (including batch_complete which needs continuation)
  if (
    audit.status === 'pending' ||
    audit.status === 'crawling' ||
    audit.status === 'checking' ||
    audit.status === 'batch_complete'
  ) {
    return <LiveProgress auditId={audit.id} initialStatus={audit.status} />
  }

  return <AuditReport audit={audit} checks={checks} pages={pages} />
}
