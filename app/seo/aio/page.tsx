import { getAIOAuditData } from './actions'
import { AIOAuditClient } from './client'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function AIOAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getAIOAuditData(organizationId)
  return <AIOAuditClient {...data} />
}
