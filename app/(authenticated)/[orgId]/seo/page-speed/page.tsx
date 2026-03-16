import { getPageSpeedData } from './actions'
import { PageSpeedClient } from './client'
import { DeprecationBanner } from '@/components/audit/deprecation-banner'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function PageSpeedPage({ params }: PageProps) {
  const { orgId: organizationId } = await params
  const data = await getPageSpeedData(organizationId)
  return (
    <>
      <DeprecationBanner auditType="Page Speed Audit" orgId={organizationId} />
      <PageSpeedClient {...data} />
    </>
  )
}
