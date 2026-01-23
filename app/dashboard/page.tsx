import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel'
import { WebsiteUrlToast } from '@/components/audit/website-url-toast'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('organization:organizations(name), organization_id')
    .eq('id', user.id)
    .single()

  if (userError || !userRecord || !userRecord.organization_id) {
    redirect('/onboarding')
  }

  // Get organization's website URL
  const { data: orgData } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Get all platform connections for this organization
  const { data: connections } = await supabase
    .from('platform_connections')
    .select('id, platform_type, account_name, display_name, status, last_sync_at')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: true })

  // Group connections by platform type
  const linkedInConnections = (connections || []).filter((c) => c.platform_type === 'linkedin')
  const googleAnalyticsConnections = (connections || []).filter((c) => c.platform_type === 'google_analytics')
  const hubspotConnections = (connections || []).filter((c) => c.platform_type === 'hubspot')

  return (
    <div className="space-y-8 p-8">
      <WebsiteUrlToast websiteUrl={orgData?.website_url || null} />
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to{' '}
          {(userRecord?.organization as unknown as { name: string } | null)?.name || 'Selo IO'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your marketing performance across all platforms
        </p>
      </div>

      <IntegrationsPanel
        linkedInConnections={linkedInConnections}
        googleAnalyticsConnections={googleAnalyticsConnections}
        hubspotConnections={hubspotConnections}
      />
    </div>
  )
}
