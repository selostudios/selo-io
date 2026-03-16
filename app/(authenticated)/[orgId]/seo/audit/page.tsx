import { getUnifiedAuditData } from './actions'
import { UnifiedAuditClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function UnifiedAuditPage({ params }: PageProps) {
  const { orgId } = await params
  const data = await getUnifiedAuditData(orgId)
  return <UnifiedAuditClient {...data} />
}
