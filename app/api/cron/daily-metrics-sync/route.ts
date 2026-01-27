import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncMetricsForLinkedInConnection } from '@/lib/platforms/linkedin/actions'
import { syncMetricsForGoogleAnalyticsConnection } from '@/lib/platforms/google-analytics/actions'
import { syncMetricsForHubSpotConnection } from '@/lib/platforms/hubspot/actions'

export async function GET() {
  return NextResponse.json({
    name: 'daily-metrics-sync',
    schedule: '0 3 * * * (Daily at 3 AM UTC)',
    description: 'Syncs metrics from all active platform connections',
  })
}

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all active platform connections
  const { data: connections, error } = await supabase
    .from('platform_connections')
    .select('id, organization_id, platform_type, credentials, status')
    .eq('status', 'active')

  if (error) {
    console.error('[Cron Error]', {
      type: 'fetch_connections_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
  }

  const results = { synced: 0, failed: 0, errors: [] as { connectionId: string; error: string }[] }

  for (const connection of connections || []) {
    try {
      switch (connection.platform_type) {
        case 'linkedin':
          await syncMetricsForLinkedInConnection(
            connection.id,
            connection.organization_id,
            connection.credentials,
            supabase
          )
          break
        case 'google_analytics':
          await syncMetricsForGoogleAnalyticsConnection(
            connection.id,
            connection.organization_id,
            connection.credentials,
            supabase
          )
          break
        case 'hubspot':
          await syncMetricsForHubSpotConnection(
            connection.id,
            connection.organization_id,
            connection.credentials,
            supabase
          )
          break
        default:
          // Skip unsupported platform types
          continue
      }
      results.synced++
    } catch (err) {
      results.failed++
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push({ connectionId: connection.id, error: errorMessage })
      console.error('[Cron Error]', {
        type: 'sync_connection_failed',
        connectionId: connection.id,
        platformType: connection.platform_type,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      })
    }
  }

  console.log('[Cron Info]', {
    type: 'daily_metrics_sync_completed',
    timestamp: new Date().toISOString(),
    results: { synced: results.synced, failed: results.failed },
  })

  return NextResponse.json(results)
}
