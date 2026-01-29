import { getReportsPageData } from './actions'
import { ReportsClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getReportsPageData(organizationId)
  return <ReportsClient {...data} />
}
