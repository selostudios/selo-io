import { History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/empty-state'
import { formatQuarterLabel } from '@/lib/reviews/period'
import { toMemoHistoryRow, type MemoVersionDbRow } from '@/lib/reviews/narrative/memo-history-types'
import type { Tables } from '@/lib/supabase/database.types'
import { StyleMemoHistoryRow } from './style-memo-history-row'

interface SnapshotDbRow {
  id: string
  review_id: string
  marketing_reviews: { quarter: string } | { quarter: string }[] | null
}

type UserDbRow = Pick<Tables<'users'>, 'id' | 'first_name' | 'last_name'>

function extractQuarter(row: SnapshotDbRow): string | null {
  const reviews = row.marketing_reviews
  if (!reviews) return null
  if (Array.isArray(reviews)) return reviews[0]?.quarter ?? null
  return reviews.quarter
}

function MemoHistoryEmptyState() {
  return (
    <EmptyState
      data-testid="style-memo-history-empty-state"
      icon={History}
      title="No history yet"
      description="Publish a report or edit the memo to see learning events here."
    />
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
        <MemoHistoryEmptyState />
      </section>
    )
  }

  const versions = (versionData ?? []) as MemoVersionDbRow[]

  if (versions.length === 0) {
    return (
      <section
        id="memo-history"
        data-testid="style-memo-history-timeline"
        className="mt-6 space-y-3"
      >
        <h3 className="text-sm font-medium">Memo history</h3>
        <MemoHistoryEmptyState />
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
      .select('id, review_id, marketing_reviews!marketing_review_snapshots_review_id_fkey(quarter)')
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
