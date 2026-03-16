import { getAIOAuditData } from './actions'
import { AIOAuditClient } from './client'
import { DeprecationBanner } from '@/components/audit/deprecation-banner'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AIOAuditPage({ params }: PageProps) {
  const { orgId: organizationId } = await params
  const data = await getAIOAuditData(organizationId)
  return (
    <>
      <DeprecationBanner auditType="AI Optimization Audit" />
      <AIOAuditClient {...data} />
    </>
  )
}
