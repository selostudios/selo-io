import { getPageSpeedData } from './actions'
import { PageSpeedClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function PageSpeedPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getPageSpeedData(organizationId)
  return <PageSpeedClient {...data} />
}
