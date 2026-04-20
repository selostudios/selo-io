export const dynamic = 'force-dynamic'

export default async function PerformanceReportSnapshotPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string; snapId: string }>
}) {
  const { orgId, id, snapId } = await params
  return (
    <div className="p-8" data-testid="performance-reports-snapshot-detail">
      <h1 className="text-2xl font-semibold">Snapshot</h1>
      <p className="text-muted-foreground text-sm">
        Coming soon — org {orgId}, review {id}, snapshot {snapId}
      </p>
    </div>
  )
}
