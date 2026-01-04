import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkedInSection } from '@/components/dashboard/linkedin-section'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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
    console.error('[Dashboard Error]', { type: 'campaign_count', timestamp: new Date().toISOString() })
  }

  // Get active campaigns with error handling
  const { count: activeCount, error: activeError } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)
    .eq('status', 'active')

  if (activeError) {
    console.error('[Dashboard Error]', { type: 'active_count', timestamp: new Date().toISOString() })
  }

  // Get LinkedIn connection status
  const { data: linkedInConnection } = await supabase
    .from('platform_connections')
    .select('id, last_sync_at')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .single()

  // Get platform connection count
  const { count: connectionCount } = await supabase
    .from('platform_connections')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to {(userRecord?.organization as unknown as { name: string } | null)?.name || 'Selo IO'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your marketing performance across all platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaignCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Platform Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{connectionCount || 0}</p>
            {!connectionCount && (
              <p className="text-sm text-muted-foreground mt-2">
                Connect platforms in Settings
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <LinkedInSection
        isConnected={!!linkedInConnection}
        lastSyncAt={linkedInConnection?.last_sync_at || null}
      />
    </div>
  )
}
