import Link from 'next/link'
import { FileText } from 'lucide-react'
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

  return (
    <div className="p-8" data-testid="performance-reports-list">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Performance Reports</h1>
          <p className="text-muted-foreground text-sm">Quarterly marketing performance reviews.</p>
        </div>
        {canCreate && (
          <Button asChild data-testid="performance-reports-new-button">
            <Link href={`/${orgId}/reports/performance/new`}>New Review</Link>
          </Button>
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
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${orgId}/reports/performance/${r.id}`}>Open</Link>
                    </Button>
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
