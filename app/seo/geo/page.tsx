import { getGEOAuditData } from './actions'
import { GEOAuditClient } from './client'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function GEOAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getGEOAuditData(organizationId)
  return <GEOAuditClient {...data} />
}
