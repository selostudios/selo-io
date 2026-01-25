import { getSiteAuditData } from './actions'
import { SiteAuditClient } from './client'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function SiteAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getSiteAuditData(organizationId)
  return <SiteAuditClient {...data} />
}
