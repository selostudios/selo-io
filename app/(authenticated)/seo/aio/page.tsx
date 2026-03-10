import { getAIOAuditData } from './actions'
import { AIOAuditClient } from './client'
import { DeprecationBanner } from '@/components/audit/deprecation-banner'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function AIOAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getAIOAuditData(organizationId)
  return (
    <>
      <DeprecationBanner auditType="AI Optimization Audit" />
      <AIOAuditClient {...data} />
    </>
  )
}
