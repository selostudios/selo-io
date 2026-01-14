import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LinkedInSection } from '@/components/dashboard/linkedin-section'
import { GoogleAnalyticsSection } from '@/components/dashboard/google-analytics-section'

const TOTAL_PLATFORMS = 4

function getConnectionColor(count: number): string {
  if (count <= 1) return 'text-red-500'
  if (count <= 3) return 'text-yellow-500'
  return 'text-green-500'
}

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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaignCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Platform Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${getConnectionColor(connectionCount || 0)}`}>
              {connectionCount || 0}/{TOTAL_PLATFORMS}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/settings/integrations">
                Manage Integrations
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <LinkedInSection
          isConnected={!!linkedInConnection}
          lastSyncAt={linkedInConnection?.last_sync_at || null}
        />
        <GoogleAnalyticsSection
          isConnected={!!gaConnection}
          lastSyncAt={gaConnection?.last_sync_at || null}
        />
      </div>
    </div>
  )
}
