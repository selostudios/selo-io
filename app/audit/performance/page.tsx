import { getPerformanceData } from './actions'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { NoUrlConfigured } from '@/components/audit/no-url-configured'

interface PageProps {
  searchParams: Promise<{ url?: string }>
}

export default async function PerformanceAuditPage({ searchParams }: PageProps) {
  const { url: initialUrl } = await searchParams
  const { audits, monitoredPages, websiteUrl } = await getPerformanceData()

  if (!websiteUrl) {
    return <NoUrlConfigured />
  }

  return (
    <PerformanceDashboard
      audits={audits}
      monitoredPages={monitoredPages}
      websiteUrl={websiteUrl}
      initialUrl={initialUrl}
    />
  )
}
