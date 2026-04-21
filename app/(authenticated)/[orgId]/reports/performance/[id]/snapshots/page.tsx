import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/cached'
import { ReviewBreadcrumb } from '@/components/reviews/review-breadcrumb'
import { formatQuarterLabel } from '@/lib/reviews/period'
import { resolvePublisherNames } from '@/lib/reviews/publishers'
import { SnapshotsTable, type SnapshotListItem } from './snapshots-client'

export const dynamic = 'force-dynamic'

interface SnapshotRow {
  id: string
  version: number
  published_at: string
  published_by: string | null
  share_token: string | null
}

/**
 * Authenticated list of all published snapshots for a performance review.
 *
 * Like the single-snapshot detail page, org-membership access is enforced by
 * the `[orgId]` layout. We still defensively redirect to `/login` if `user`
 * is null so a layout bug can't leak data here.
 */
export default async function PerformanceReportSnapshotsListPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id: reviewId } = await params

  const user = await getAuthUser()
  if (!user) redirect('/login') // defensive — layout should have caught this

  const supabase = await createClient()

  const { data: review } = await supabase
    .from('marketing_reviews')
    .select('id, title, quarter, organization_id')
    .eq('id', reviewId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!review) notFound()

  const { data: snapshotsData } = await supabase
    .from('marketing_review_snapshots')
    .select('id, version, published_at, published_by, share_token')
    .eq('review_id', reviewId)
    .order('version', { ascending: false })

  const snapshots = (snapshotsData ?? []) as SnapshotRow[]

  const publisherIds = snapshots
    .map((s) => s.published_by)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  const publisherNames = await resolvePublisherNames(supabase, publisherIds)

  const quarter = review.quarter as string
  const title = (review.title as string | null) ?? null
  const quarterLabel = formatQuarterLabel(quarter)

  const editorHref = `/${orgId}/reports/performance/${reviewId}`
  const basePath = `${editorHref}/snapshots`

  const items: SnapshotListItem[] = snapshots.map((snap) => ({
    id: snap.id,
    version: snap.version,
    publishedAt: formatPublishedDate(snap.published_at),
    publishedByName: snap.published_by ? (publisherNames.get(snap.published_by) ?? null) : null,
    hasShareLink: !!snap.share_token,
  }))

  return (
    <div
      className="mx-auto max-w-5xl space-y-6 p-4 md:p-8"
      data-testid="performance-reports-snapshots-list"
    >
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: `/${orgId}/reports/performance` },
          { label: quarterLabel, href: editorHref },
          { label: 'Snapshots' },
        ]}
      />

      <div>
        <h1
          className="text-2xl font-semibold"
          data-testid="performance-reports-snapshots-list-title"
        >
          Snapshots for {quarterLabel}
        </h1>
        {title && <p className="text-muted-foreground text-sm">{title}</p>}
      </div>

      <SnapshotsTable snapshots={items} basePath={basePath} />
    </div>
  )
}

/**
 * Formats a snapshot `published_at` timestamp as a short absolute date,
 * e.g. "Apr 20, 2026". Kept identical to the snapshot detail page so users
 * comparing versions see consistent dates in both views.
 */
function formatPublishedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
