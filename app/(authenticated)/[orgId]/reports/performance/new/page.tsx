import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { currentQuarter, parseQuarter } from '@/lib/reviews/period'
import { Button } from '@/components/ui/button'
import { NewReviewForm } from './new-review-form'

export const dynamic = 'force-dynamic'

function buildQuarterOptions(now: Date, lookbackYears = 2): string[] {
  const current = currentQuarter(now)
  const { year, quarter } = parseQuarter(current)
  const options: string[] = []
  for (let yOffset = 0; yOffset <= lookbackYears; yOffset++) {
    for (let q = 4; q >= 1; q--) {
      const y = year - yOffset
      if (yOffset === 0 && q > quarter) continue
      options.push(`${y}-Q${q}`)
    }
  }
  return options
}

export default async function NewPerformanceReportPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const user = await getAuthUser()
  const userRecord = user ? await getUserRecord(user.id) : null
  if (!userRecord) redirect(`/${orgId}/reports/performance`)
  const canCreate = isInternalUser(userRecord) || userRecord.role === UserRole.Admin
  if (!canCreate) redirect(`/${orgId}/reports/performance`)

  const quarters = buildQuarterOptions(new Date())
  const defaultQuarter = quarters[0]

  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="performance-reports-new">
      <h1 className="text-2xl font-semibold">New Performance Report</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Pick a quarter. We&apos;ll seed a draft with the latest data from your connected platforms.
      </p>

      <NewReviewForm orgId={orgId} quarters={quarters} defaultQuarter={defaultQuarter} />

      <div className="mt-6">
        <Button variant="ghost" asChild>
          <Link href={`/${orgId}/reports/performance`}>Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
