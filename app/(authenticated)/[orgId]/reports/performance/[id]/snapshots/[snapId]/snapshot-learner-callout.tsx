import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * Muted callout shown on the snapshot detail page describing what the AI
 * learner took away from this particular snapshot. Pulled from the most
 * recent `auto` row in `marketing_review_style_memo_versions` for the
 * snapshot. Renders nothing when there is no rationale yet (new snapshot
 * with a stale learner, or a learner run that couldn't produce a rationale).
 *
 * The "View full history" link is only shown to users who can manage the
 * memo (admins + internal). Clients and team members see just the rationale
 * — they don't have access to the settings timeline anyway.
 */
export async function SnapshotLearnerCallout({
  snapshotId,
  orgId,
  canManage,
}: {
  snapshotId: string
  orgId: string
  canManage: boolean
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_review_style_memo_versions')
    .select('rationale, created_at')
    .eq('snapshot_id', snapshotId)
    .eq('source', 'auto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[SnapshotLearnerCallout Error]', {
      type: 'memo_version_query_failed',
      snapshotId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const row = data as { rationale: string | null; created_at: string } | null
  if (!row || !row.rationale) return null

  const relative = formatDistanceToNow(new Date(row.created_at), { addSuffix: true })

  return (
    <div
      data-testid="snapshot-learner-callout"
      className="bg-muted/30 relative rounded-md border p-4"
    >
      <div className="bg-primary/60 absolute top-0 left-0 h-full w-1 rounded-l-md" />
      <div className="pl-3">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Sparkles className="text-primary h-4 w-4" aria-hidden />
          <span>What the AI learned from this report</span>
        </div>
        <p
          data-testid="snapshot-learner-callout-rationale"
          className="text-muted-foreground mt-1.5 text-sm"
        >
          {row.rationale}
        </p>
        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
          <span>Updated {relative}</span>
          {canManage ? (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/${orgId}/reports/performance/settings#memo-history`}
                className="hover:text-foreground underline underline-offset-2"
              >
                View full history
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
