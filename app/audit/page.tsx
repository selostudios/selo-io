import { getAuditData } from './actions'
import { AuditDashboard } from '@/components/audit/audit-dashboard'
import { NoUrlConfigured } from '@/components/audit/no-url-configured'

export default async function AuditPage() {
  const { websiteUrl, audits, archivedAudits } = await getAuditData()

  if (!websiteUrl) {
    return <NoUrlConfigured />
  }

  return <AuditDashboard websiteUrl={websiteUrl} audits={audits} archivedAudits={archivedAudits} />
}
