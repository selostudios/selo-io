export const dynamic = 'force-dynamic'

export default async function PerformanceReportSnapshotsPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params
  return (
    <div className="p-8" data-testid="performance-reports-snapshots-list">
      <h1 className="text-2xl font-semibold">Snapshot History</h1>
      <p className="text-muted-foreground text-sm">
        Coming soon — org {orgId}, review {id}
      </p>
    </div>
  )
}
