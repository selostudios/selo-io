export const dynamic = 'force-dynamic'

export default async function PerformanceReportsListPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  return (
    <div className="p-8" data-testid="performance-reports-list">
      <h1 className="text-2xl font-semibold">Performance Reports</h1>
      <p className="text-muted-foreground text-sm">Coming soon — org {orgId}</p>
    </div>
  )
}
