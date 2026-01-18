import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel'
import { MetricCard } from '@/components/dashboard/metric-card'

const TOTAL_PLATFORMS = 4

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

  // Get campaign count with error handling
  const { count: campaignCount, error: campaignError } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)

  if (campaignError) {
    console.error('[Dashboard Error]', {
      type: 'campaign_count',
      timestamp: new Date().toISOString(),
    })
  }

  // Get active campaigns with error handling
  const { count: activeCount, error: activeError } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)
    .eq('status', 'active')

  if (activeError) {
    console.error('[Dashboard Error]', {
      type: 'active_count',
      timestamp: new Date().toISOString(),
    })
  }

  // Get LinkedIn connection status
  const { data: linkedInConnection } = await supabase
    .from('platform_connections')
    .select('id, last_sync_at')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .single()

  // Get Google Analytics connection status
  const { data: gaConnection } = await supabase
    .from('platform_connections')
    .select('id, last_sync_at')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'google_analytics')
    .single()

  // Get HubSpot connection status
  const { data: hubspotConnection } = await supabase
    .from('platform_connections')
    .select('id, last_sync_at')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'hubspot')
    .single()

  // Get platform connection count
  const { count: connectionCount } = await supabase
    .from('platform_connections')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to{' '}
          {(userRecord?.organization as unknown as { name: string } | null)?.name || 'Selo IO'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your marketing performance across all platforms
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <MetricCard label="Active" value={activeCount || 0} change={null} />
            <MetricCard label="Total" value={campaignCount || 0} change={null} />
          </div>
        </CardContent>
      </Card>

      <IntegrationsPanel
        linkedIn={{
          isConnected: !!linkedInConnection,
          lastSyncAt: linkedInConnection?.last_sync_at || null,
        }}
        googleAnalytics={{
          isConnected: !!gaConnection,
          lastSyncAt: gaConnection?.last_sync_at || null,
        }}
        hubspot={{
          isConnected: !!hubspotConnection,
          lastSyncAt: hubspotConnection?.last_sync_at || null,
        }}
        connectionCount={connectionCount || 0}
        totalPlatforms={TOTAL_PLATFORMS}
      />
    </div>
  )
}
