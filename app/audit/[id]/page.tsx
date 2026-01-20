import { notFound } from 'next/navigation'
import { getAuditReport } from './actions'
import { AuditReport } from '@/components/audit/audit-report'
import { LiveProgress } from '@/components/audit/live-progress'

interface AuditReportPageProps {
  params: Promise<{ id: string }>
}

export default async function AuditReportPage({ params }: AuditReportPageProps) {
  const { id } = await params
  const data = await getAuditReport(id)

  if (!data) {
    notFound()
  }

  const { audit, checks, pages } = data

  // Show progress view for in-progress audits
  if (audit.status === 'pending' || audit.status === 'crawling' || audit.status === 'checking') {
    return <LiveProgress auditId={audit.id} initialStatus={audit.status} />
  }

  return <AuditReport audit={audit} checks={checks} pages={pages} />
}
