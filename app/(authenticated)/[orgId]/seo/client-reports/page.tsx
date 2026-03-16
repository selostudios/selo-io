import { getClientReportsPageData } from './actions'
import { ClientReportsClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function ClientReportsPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getClientReportsPageData(organizationId)
  return <ClientReportsClient {...data} />
}
