import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Gauge } from 'lucide-react'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'

interface PerformanceDashboardProps {
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  websiteUrl: string
}

/**
 * Placeholder component for the Performance Dashboard.
 * Full implementation will be added in Task 12.
 */
export function PerformanceDashboard({
  audits,
  monitoredPages,
  websiteUrl,
}: PerformanceDashboardProps) {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-balance">Performance Audit</h1>
      <Card className="max-w-2xl">
        <CardHeader className="text-center">
          <div className="bg-muted mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
            <Gauge className="text-muted-foreground h-6 w-6" />
          </div>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>
            Monitor Core Web Vitals and Lighthouse scores for {websiteUrl}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground space-y-2 text-center text-sm">
            <p>
              {audits.length} audit{audits.length !== 1 ? 's' : ''} recorded
            </p>
            <p>
              {monitoredPages.length} page{monitoredPages.length !== 1 ? 's' : ''} being monitored
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
