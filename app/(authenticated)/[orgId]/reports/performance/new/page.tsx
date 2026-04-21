import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NewPerformanceReportPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  redirect(`/${orgId}/reports/performance`)
}
