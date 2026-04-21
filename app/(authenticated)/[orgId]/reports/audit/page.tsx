import { getClientReportsPageData } from './actions'
import { ClientReportsClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ClientReportsPage({ params }: PageProps) {
  const { orgId } = await params
  const data = await getClientReportsPageData(orgId)
  return <ClientReportsClient {...data} />
}
