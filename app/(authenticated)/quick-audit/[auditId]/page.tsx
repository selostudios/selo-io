import { getCurrentUser } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import { getAuditOverview } from '@/app/(authenticated)/[orgId]/seo/audit/[id]/actions'
import { UnifiedAuditDetailClient } from '@/app/(authenticated)/[orgId]/seo/audit/[id]/client'
import { UnifiedLiveProgress } from '@/components/audit/unified-live-progress'
import { UnifiedAuditStatus } from '@/lib/enums'

interface PageProps {
  params: Promise<{ auditId: string }>
}

const IN_PROGRESS_STATUSES = [
  UnifiedAuditStatus.Pending,
  UnifiedAuditStatus.Crawling,
  UnifiedAuditStatus.Checking,
  UnifiedAuditStatus.Analyzing,
  UnifiedAuditStatus.BatchComplete,
  UnifiedAuditStatus.AwaitingConfirmation,
]

export default async function QuickAuditDetailPage({ params }: PageProps) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (!currentUser.isInternal) redirect('/dashboard')

  const { auditId } = await params
  const { audit, tabCounts } = await getAuditOverview(auditId)

  if (IN_PROGRESS_STATUSES.includes(audit.status)) {
    return <UnifiedLiveProgress auditId={audit.id} initialStatus={audit.status} />
  }

  return (
    <UnifiedAuditDetailClient
      audit={audit}
      tabCounts={tabCounts}
      backHref="/quick-audit"
      backLabel="Back to Quick Audit"
    />
  )
}
