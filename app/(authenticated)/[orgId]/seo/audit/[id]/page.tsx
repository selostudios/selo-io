import { getUnifiedAuditReport } from './actions'
import { UnifiedAuditDetailClient } from './client'
import { UnifiedLiveProgress } from '@/components/audit/unified-live-progress'
import { UnifiedAuditStatus } from '@/lib/enums'

interface PageProps {
  params: Promise<{ orgId: string; id: string }>
}

const IN_PROGRESS_STATUSES = [
  UnifiedAuditStatus.Pending,
  UnifiedAuditStatus.Crawling,
  UnifiedAuditStatus.Checking,
  UnifiedAuditStatus.Analyzing,
  UnifiedAuditStatus.BatchComplete,
  UnifiedAuditStatus.AwaitingConfirmation,
]

export default async function UnifiedAuditDetailPage({ params }: PageProps) {
  const { id } = await params
  const { audit, checks, pages } = await getUnifiedAuditReport(id)

  if (IN_PROGRESS_STATUSES.includes(audit.status)) {
    return <UnifiedLiveProgress auditId={audit.id} initialStatus={audit.status} />
  }

  return <UnifiedAuditDetailClient audit={audit} checks={checks} pages={pages} />
}
