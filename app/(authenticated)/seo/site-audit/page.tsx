import { getSiteAuditData } from './actions'
import { SiteAuditClient } from './client'
import { DeprecationBanner } from '@/components/audit/deprecation-banner'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function SiteAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getSiteAuditData(organizationId)
  return (
    <>
      <DeprecationBanner auditType="Site Audit" />
      <SiteAuditClient {...data} />
    </>
  )
}
