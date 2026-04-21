import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyClientReportDetailRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgId, id } = await params
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === 'string') sp.set(k, v)
    else if (Array.isArray(v)) for (const vi of v) sp.append(k, vi)
  }
  const qs = sp.toString()
  redirect(`/${orgId}/reports/audit/${id}${qs ? `?${qs}` : ''}`)
}
