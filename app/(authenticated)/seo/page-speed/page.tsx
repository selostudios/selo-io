import { getPageSpeedData } from './actions'
import { PageSpeedClient } from './client'
import { DeprecationBanner } from '@/components/audit/deprecation-banner'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function PageSpeedPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getPageSpeedData(organizationId)
  return (
    <>
      <DeprecationBanner auditType="Page Speed Audit" />
      <PageSpeedClient {...data} />
    </>
  )
}
