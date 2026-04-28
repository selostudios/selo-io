import Link from 'next/link'
import { ExternalLink, FileText, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { buildQuarterOptions } from '@/lib/reviews/period'
import { NewReviewDialog } from './new-review-dialog'
import { PerformanceReportRowActions } from './report-row-actions'

export const dynamic = 'force-dynamic'

interface ReviewRow {
  id: string
  quarter: string
  title: string
  updated_at: string
  latest_snapshot_id: string | null
  latest_snapshot: { published_at: string } | null
}

export default async function PerformanceReportsListPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const user = await getAuthUser()
  const userRecord = user ? await getUserRecord(user.id) : null
  const canCreate =
    !!userRecord && (isInternalUser(userRecord) || userRecord.role === UserRole.Admin)

  const supabase = await createClient()
  const { data } = await supabase
    .from('marketing_reviews')
    .select(
      'id, quarter, title, updated_at, latest_snapshot_id, latest_snapshot:marketing_review_snapshots!marketing_reviews_latest_snapshot_fk(published_at)'
    )
    .eq('organization_id', orgId)
    .order('quarter', { ascending: false })

  const reviews = (data ?? []) as unknown as ReviewRow[]
  const quarterOptions = buildQuarterOptions(new Date())

  return (
    <div className="p-8" data-testid="performance-reports-list">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marketing Reports</h1>
          <p className="text-muted-foreground text-sm">Quarterly marketing performance reviews.</p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              asChild
              data-testid="performance-reports-settings-button"
              aria-label="Prompt settings"
            >
              <Link href={`/${orgId}/reports/performance/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <NewReviewDialog
              orgId={orgId}
              quarters={quarterOptions}
              defaultQuarter={quarterOptions[0]}
            />
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div data-testid="performance-reports-empty-state">
          <EmptyState
            icon={FileText}
            title="No performance reports yet"
            description={
              canCreate
                ? 'Create the first quarterly review to get started.'
                : 'An admin needs to create the first quarterly review.'
            }
          />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Latest snapshot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r) => (
                <TableRow key={r.id} data-testid={`performance-report-row-${r.id}`}>
                  <TableCell className="font-medium">{r.quarter}</TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>
                    {r.latest_snapshot ? formatDate(r.latest_snapshot.published_at, false) : '—'}
                  </TableCell>
                  <TableCell>
                    {r.latest_snapshot_id ? (
                      <Badge variant="default">Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canCreate ? (
                      <PerformanceReportRowActions
                        orgId={orgId}
                        reviewId={r.id}
                        quarter={r.quarter}
                        latestSnapshotId={r.latest_snapshot_id}
                      />
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={
                            r.latest_snapshot_id
                              ? `/${orgId}/reports/performance/${r.id}/snapshots/${r.latest_snapshot_id}`
                              : `/${orgId}/reports/performance/${r.id}`
                          }
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          View Report
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
