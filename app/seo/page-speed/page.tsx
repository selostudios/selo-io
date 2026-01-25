import { getPageSpeedData } from './actions'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gauge } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ url?: string }>
}

export default async function PageSpeedPage({ searchParams }: PageProps) {
  const { url: initialUrl } = await searchParams
  const { audits, monitoredPages, organizationId } = await getPageSpeedData()

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <Gauge className="mt-1 h-8 w-8 text-neutral-700" />
        <div>
          <h1 className="text-3xl font-bold">Page Speed</h1>
          <p className="text-muted-foreground">
            Measure Core Web Vitals, load times, and performance scores using Google PageSpeed
            Insights
          </p>
        </div>
      </div>

      {/* If no audits exist, show getting started message */}
      {audits.length === 0 && monitoredPages.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Gauge className="h-6 w-6 text-neutral-600" />
            </div>
            <CardTitle>Get Started with Page Speed</CardTitle>
            <CardDescription>
              Run your first page speed audit by entering a URL below.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Show dashboard */}
      <PerformanceDashboard
        audits={audits}
        monitoredPages={monitoredPages}
        websiteUrl=""
        initialUrl={initialUrl}
        projectId={organizationId}
      />
    </div>
  )
}
