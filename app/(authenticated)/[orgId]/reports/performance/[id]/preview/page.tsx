import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatQuarterLabel, periodsForQuarter } from '@/lib/reviews/period'
import { parseHiddenSlides } from '@/lib/reviews/slides/registry'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { PreviewClient } from './preview-client'

export const dynamic = 'force-dynamic'

/**
 * Preview route for the **current draft** of a performance review.
 *
 * Access is limited to admins of the review's organization and internal Selo
 * users. Other authenticated users are redirected to the editor page so
 * unpublished narrative never leaks to clients. (We redirect to the editor
 * rather than the public share to avoid a second round-trip through access
 * checks on a route that's still mutable.)
 */
export default async function PerformanceReportPreviewPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params

  const user = await getAuthUser()
  if (!user) redirect('/login') // defensive — layout should have caught this
  const userRecord = await getUserRecord(user.id)

  const canEdit = !!userRecord && (isInternalUser(userRecord) || userRecord.role === UserRole.Admin)

  if (!canEdit) {
    redirect(`/${orgId}/reports/performance/${id}`)
  }

  const supabase = await createClient()
  const { data: review } = await supabase
    .from('marketing_reviews')
    .select('id, title, quarter, organization_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!review) notFound()

  const [{ data: draft }, { data: org }] = await Promise.all([
    supabase
      .from('marketing_review_drafts')
      .select('narrative, data, hidden_slides')
      .eq('review_id', id)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  if (!draft) {
    return (
      <div
        className="bg-background fixed inset-0 z-50 flex items-center justify-center p-8"
        data-testid="performance-reports-preview-no-draft"
      >
        <EmptyState
          icon={FileText}
          title="No draft yet"
          description="Generate a narrative on the editor page before previewing the deck."
          className="w-full max-w-md p-8"
        >
          <Button asChild className="mt-4">
            <Link href={`/${orgId}/reports/performance/${id}`}>Back to editor</Link>
          </Button>
        </EmptyState>
      </div>
    )
  }

  const narrative = (draft.narrative as NarrativeBlocks | null) ?? {}
  const data = (draft.data as SnapshotData | null) ?? {}
  const hiddenSlides = parseHiddenSlides(draft.hidden_slides)
  const quarterLabel = formatQuarterLabel(review.quarter as string)
  const periods = periodsForQuarter(review.quarter as string)

  return (
    <PreviewClient
      reviewId={id}
      orgId={orgId}
      organization={{
        name: (org?.name as string | undefined) ?? 'Organization',
        logo_url: (org?.logo_url as string | null | undefined) ?? null,
        primary_color: (org?.primary_color as string | null | undefined) ?? null,
      }}
      quarter={quarterLabel}
      periodStart={periods.main.start}
      periodEnd={periods.main.end}
      narrative={narrative}
      data={data}
      hiddenSlides={hiddenSlides}
    />
  )
}
