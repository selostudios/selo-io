import { getSiteAuditData } from './actions'
import { SiteAuditClient } from './client'
import { DeprecationBanner } from '@/components/audit/deprecation-banner'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function SiteAuditPage({ params }: PageProps) {
  const { orgId: organizationId } = await params
  const data = await getSiteAuditData(organizationId)
  return (
    <>
      <DeprecationBanner auditType="Site Audit" orgId={organizationId} />
      <SiteAuditClient {...data} />
    </>
  )
}
