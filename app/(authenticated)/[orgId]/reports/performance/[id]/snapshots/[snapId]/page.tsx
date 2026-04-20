import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/cached'
import { ReviewDeck } from '@/components/reviews/review-deck'
import { formatQuarterLabel } from '@/lib/reviews/period'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { SnapshotShareButton } from './snapshot-client'

export const dynamic = 'force-dynamic'

/**
 * Authenticated detail view for a single published snapshot of a performance
 * review. Unlike the draft preview, this page is part of the normal
 * dashboard shell (sidebar + breadcrumb) because snapshots are shareable
 * internal references — users often land here from the snapshots list.
 *
 * Access is enforced by `app/(authenticated)/[orgId]/layout.tsx`, which
 * already redirects non-internal users who aren't members of the requested
 * organization. This page only needs to ensure the review and snapshot
 * actually exist and are correlated correctly.
 */
export default async function PerformanceReportSnapshotDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string; snapId: string }>
}) {
  const { orgId, id: reviewId, snapId } = await params

  const user = await getAuthUser()
  if (!user) redirect('/login') // defensive — layout should have caught this

  const supabase = await createClient()

  const [reviewRes, snapshotRes, orgRes] = await Promise.all([
    supabase
      .from('marketing_reviews')
      .select('id, title, quarter, organization_id')
      .eq('id', reviewId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('marketing_review_snapshots')
      .select(
        'id, review_id, version, period_start, period_end, published_at, published_by, narrative, data'
      )
      .eq('id', snapId)
      .eq('review_id', reviewId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  const review = reviewRes.data
  const snapshot = snapshotRes.data
  const org = orgRes.data

  if (!review) notFound()
  if (!snapshot) notFound()

  // Fetch publisher name — best-effort. RLS may hide cross-org users; the
  // fallback just omits the "by {name}" suffix rather than erroring.
  const publishedBy = snapshot.published_by as string | null
  let publisherName: string | null = null
  if (publishedBy) {
    const { data: publisher } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', publishedBy)
      .maybeSingle()
    if (publisher) {
      const first = (publisher.first_name as string | null) ?? ''
      const last = (publisher.last_name as string | null) ?? ''
      const full = `${first} ${last}`.trim()
      publisherName = full.length > 0 ? full : null
    }
  }

  const quarter = review.quarter as string
  const quarterLabel = formatQuarterLabel(quarter)
  const version = snapshot.version as number
  const narrative = (snapshot.narrative as NarrativeBlocks | null) ?? {}
  const data = (snapshot.data as SnapshotData | null) ?? {}
  const periodStart = snapshot.period_start as string
  const periodEnd = snapshot.period_end as string
  const publishedAtLabel = formatPublishedDate(snapshot.published_at as string)

  const editorHref = `/${orgId}/reports/performance/${reviewId}`
  const snapshotsHref = `/${orgId}/reports/performance/${reviewId}/snapshots`

  return (
    <div
      className="mx-auto max-w-6xl space-y-4 p-4 md:p-8"
      data-testid="performance-reports-snapshot-detail"
    >
      <nav aria-label="Breadcrumb" data-testid="performance-reports-snapshot-breadcrumb">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
          <li>
            <Link
              href={`/${orgId}/reports/performance`}
              className="hover:text-foreground hover:underline"
            >
              Performance reports
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>
            <Link href={editorHref} className="hover:text-foreground hover:underline">
              {quarterLabel}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>
            <Link href={snapshotsHref} className="hover:text-foreground hover:underline">
              Snapshots
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li className="text-foreground font-medium" aria-current="page">
            v{version}
          </li>
        </ol>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="performance-reports-snapshot-title">
            {review.title as string} — v{version}
          </h1>
          <p
            className="text-muted-foreground text-sm"
            data-testid="performance-reports-snapshot-metadata"
          >
            {publisherName
              ? `Published ${publishedAtLabel} by ${publisherName}`
              : `Published ${publishedAtLabel}`}
          </p>
        </div>
        <SnapshotShareButton snapshotId={snapshot.id as string} />
      </div>

      <div className="aspect-video w-full">
        <ReviewDeck
          organization={{
            name: (org?.name as string | undefined) ?? 'Organization',
            logo_url: (org?.logo_url as string | null | undefined) ?? null,
            primary_color: (org?.primary_color as string | null | undefined) ?? null,
          }}
          quarter={quarterLabel}
          periodStart={periodStart}
          periodEnd={periodEnd}
          narrative={narrative}
          data={data}
        />
      </div>
    </div>
  )
}

/**
 * Formats a snapshot's `published_at` ISO timestamp as a short absolute date,
 * e.g. "Apr 20, 2026". Snapshots live forever so absolute dates read better
 * than relative ("3 months ago") — users comparing v1 vs v4 want to see the
 * actual period not a drift-prone relative label.
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
