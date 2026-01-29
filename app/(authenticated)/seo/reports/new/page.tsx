import { NewReportClient } from './client'
import { getNewReportData } from './actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string; domain?: string }>
}

export default async function NewReportPage({ searchParams }: PageProps) {
  const { org: organizationId, domain } = await searchParams
  const data = await getNewReportData(organizationId, domain)
  return <NewReportClient {...data} />
}
