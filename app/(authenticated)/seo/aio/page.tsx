import { getAIOAuditData } from './actions'
import { AIOAuditClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function AIOAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getAIOAuditData(organizationId)
  return <AIOAuditClient {...data} />
}
