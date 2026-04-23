import { createClient } from '@/lib/supabase/server'
import { formatQuarterLabel } from '@/lib/reviews/period'
import type { MemoHistoryRow, MemoHistorySource } from '@/lib/reviews/narrative/memo-history-types'
import { StyleMemoHistoryRow } from './style-memo-history-row'

interface VersionDbRow {
  id: string
  organization_id: string
  snapshot_id: string | null
  memo: string
  rationale: string | null
  source: MemoHistorySource
  created_by: string | null
  created_at: string
}

interface SnapshotDbRow {
  id: string
  review_id: string
  marketing_reviews: { quarter: string } | { quarter: string }[] | null
}

interface UserDbRow {
  id: string
  first_name: string | null
  last_name: string | null
}

function toMemoHistoryRow(row: VersionDbRow): MemoHistoryRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    snapshotId: row.snapshot_id,
    memo: row.memo,
    rationale: row.rationale,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function extractQuarter(row: SnapshotDbRow): string | null {
  const reviews = row.marketing_reviews
  if (!reviews) return null
  if (Array.isArray(reviews)) return reviews[0]?.quarter ?? null
  return reviews.quarter
}

function EmptyState() {
  return (
    <p
      data-testid="style-memo-history-empty-state"
      className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      No history yet — publish a report or edit the memo to see learning events here.
    </p>
  )
}

/**
 * Timeline of every change to the learned-style memo for this organization —
 * both `auto` updates from the learner and `manual` edits from settings.
 * Mounted on the performance reports settings page so admins can trace why
 * the memo reads the way it does today.
 */
export async function StyleMemoHistoryTimeline({ orgId }: { orgId: string }) {
  const supabase = await createClient()

  const { data: versionData, error: versionError } = await supabase
    .from('marketing_review_style_memo_versions')
    .select('id, organization_id, snapshot_id, memo, rationale, source, created_by, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (versionError) {
    console.error('[StyleMemoHistoryTimeline Error]', {
      type: 'memo_versions_query_failed',
      orgId,
      message: versionError.message,
      timestamp: new Date().toISOString(),
    })
    return (
      <section
        id="memo-history"
        data-testid="style-memo-history-timeline"
        className="mt-6 space-y-3"
      >
        <h3 className="text-sm font-medium">Memo history</h3>
        <EmptyState />
      </section>
    )
  }

  const versions = (versionData ?? []) as VersionDbRow[]

  if (versions.length === 0) {
    return (
      <section
        id="memo-history"
        data-testid="style-memo-history-timeline"
        className="mt-6 space-y-3"
      >
        <h3 className="text-sm font-medium">Memo history</h3>
        <EmptyState />
      </section>
    )
  }

  const snapshotIds = Array.from(
    new Set(versions.map((v) => v.snapshot_id).filter((id): id is string => Boolean(id)))
  )
  const creatorIds = Array.from(
    new Set(versions.map((v) => v.created_by).filter((id): id is string => Boolean(id)))
  )

  const snapshotLookup = new Map<string, { reviewId: string; quarter: string }>()
  if (snapshotIds.length > 0) {
    const { data: snapshotData, error: snapshotError } = await supabase
      .from('marketing_review_snapshots')
      .select('id, review_id, marketing_reviews(quarter)')
      .in('id', snapshotIds)

    if (snapshotError) {
      console.error('[StyleMemoHistoryTimeline Error]', {
        type: 'snapshots_query_failed',
        orgId,
        message: snapshotError.message,
        timestamp: new Date().toISOString(),
      })
    } else {
      for (const snap of (snapshotData ?? []) as SnapshotDbRow[]) {
        const quarter = extractQuarter(snap)
        if (!quarter) continue
        snapshotLookup.set(snap.id, { reviewId: snap.review_id, quarter })
      }
    }
  }

  const creatorLookup = new Map<string, string>()
  if (creatorIds.length > 0) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', creatorIds)

    if (userError) {
      console.error('[StyleMemoHistoryTimeline Error]', {
        type: 'creators_query_failed',
        orgId,
        message: userError.message,
        timestamp: new Date().toISOString(),
      })
    } else {
      for (const user of (userData ?? []) as UserDbRow[]) {
        const first = (user.first_name ?? '').trim()
        const last = (user.last_name ?? '').trim()
        const full = `${first} ${last}`.trim()
        if (full.length > 0) creatorLookup.set(user.id, full)
      }
    }
  }

  return (
    <section id="memo-history" data-testid="style-memo-history-timeline" className="mt-6 space-y-3">
      <h3 className="text-sm font-medium">Memo history</h3>
      <div className="space-y-2">
        {versions.map((dbRow, index) => {
          const row = toMemoHistoryRow(dbRow)
          const snapshotEntry = row.snapshotId ? snapshotLookup.get(row.snapshotId) : undefined
          const adminName = row.createdBy ? (creatorLookup.get(row.createdBy) ?? null) : null
          return (
            <StyleMemoHistoryRow
              key={row.id}
              row={row}
              adminName={adminName}
              reviewId={snapshotEntry?.reviewId ?? null}
              quarterLabel={snapshotEntry ? formatQuarterLabel(snapshotEntry.quarter) : null}
              orgId={orgId}
              index={index}
            />
          )
        })}
      </div>
    </section>
  )
}
