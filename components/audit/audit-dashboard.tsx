interface AuditDashboardProps {
  websiteUrl: string
  audits: unknown[]
  archivedAudits: unknown[]
}

export function AuditDashboard({ websiteUrl, audits, archivedAudits }: AuditDashboardProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">AuditDashboard coming soon</h1>
      <p className="text-muted-foreground mt-2">Website: {websiteUrl}</p>
      <p className="text-muted-foreground">Active audits: {audits.length}</p>
      <p className="text-muted-foreground">Archived audits: {archivedAudits.length}</p>
    </div>
  )
}
