import { getUnifiedAuditData } from './actions'
import { UnifiedAuditClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function UnifiedAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getUnifiedAuditData(organizationId)
  return <UnifiedAuditClient {...data} />
}
