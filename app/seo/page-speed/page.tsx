import { getPageSpeedData } from './actions'
import { PageSpeedClient } from './client'

interface PageProps {
  searchParams: Promise<{ org?: string; url?: string }>
}

export default async function PageSpeedPage({ searchParams }: PageProps) {
  const { org: organizationId, url: initialUrl } = await searchParams
  const data = await getPageSpeedData(organizationId)
  return <PageSpeedClient {...data} initialUrl={initialUrl} />
}
