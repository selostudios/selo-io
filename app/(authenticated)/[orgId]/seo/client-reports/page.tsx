import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyClientReportsRedirectPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  redirect(`/${orgId}/reports/audit`)
}
