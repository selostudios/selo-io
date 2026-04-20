export const dynamic = 'force-dynamic'

export default async function NewPerformanceReportPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  return (
    <div className="p-8" data-testid="performance-reports-new">
      <h1 className="text-2xl font-semibold">New Performance Report</h1>
      <p className="text-muted-foreground text-sm">Coming soon — org {orgId}</p>
    </div>
  )
}
