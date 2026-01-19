import { getPerformanceData } from './actions'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { NoUrlConfigured } from '@/components/audit/no-url-configured'

export default async function PerformanceAuditPage() {
  const { audits, monitoredPages, websiteUrl } = await getPerformanceData()

  if (!websiteUrl) {
    return <NoUrlConfigured />
  }

  return (
    <PerformanceDashboard audits={audits} monitoredPages={monitoredPages} websiteUrl={websiteUrl} />
  )
}
