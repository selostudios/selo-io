import { createClient } from '@/lib/supabase/server'
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel'
import { WebsiteUrlToast } from '@/components/audit/website-url-toast'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DashboardPage({ params }: PageProps) {
  const { orgId: organizationId } = await params

  const supabase = await createClient()

  // Fetch org details and connections in parallel
  const [{ data: orgData }, { data: connections }] = await Promise.all([
    supabase.from('organizations').select('name, website_url').eq('id', organizationId).single(),
    supabase
      .from('platform_connections')
      .select('id, platform_type, account_name, display_name, status, last_sync_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
  ])

  // Group connections by platform type
  const linkedInConnections = (connections || []).filter((c) => c.platform_type === 'linkedin')
  const googleAnalyticsConnections = (connections || []).filter(
    (c) => c.platform_type === 'google_analytics'
  )
  const hubspotConnections = (connections || []).filter((c) => c.platform_type === 'hubspot')

  return (
    <div className="space-y-8 p-8" data-testid="dashboard-page">
      <WebsiteUrlToast websiteUrl={orgData?.website_url || null} />

      <IntegrationsPanel
        organizationId={organizationId}
        linkedInConnections={linkedInConnections}
        googleAnalyticsConnections={googleAnalyticsConnections}
        hubspotConnections={hubspotConnections}
      />
    </div>
  )
}
