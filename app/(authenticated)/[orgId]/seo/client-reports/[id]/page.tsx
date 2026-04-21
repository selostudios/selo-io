import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyClientReportDetailRedirectPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params
  redirect(`/${orgId}/reports/audit/${id}`)
}
