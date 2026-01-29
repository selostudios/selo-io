import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncMetricsForLinkedInConnection } from '@/lib/platforms/linkedin/actions'
import { syncMetricsForGoogleAnalyticsConnection } from '@/lib/platforms/google-analytics/actions'
import { syncMetricsForHubSpotConnection } from '@/lib/platforms/hubspot/actions'

/**
 * Generate array of dates between start and end (inclusive)
 */
function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional backfill parameters from request body
  let startDate: Date | undefined
  let endDate: Date | undefined

  try {
    const body = await request.json().catch(() => ({}))
    if (body.startDate) {
      startDate = new Date(body.startDate)
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ error: 'Invalid startDate format' }, { status: 400 })
      }
    }
    if (body.endDate) {
      endDate = new Date(body.endDate)
      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid endDate format' }, { status: 400 })
      }
    }
  } catch {
    // No body or invalid JSON - continue with default (yesterday only)
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

  // Determine dates to sync - use explicit check to help TypeScript narrow types
  let datesToSync: Date[] = []
  let isBackfill = false
  if (startDate && endDate) {
    isBackfill = true
    datesToSync = getDateRange(startDate, endDate)
  }

  const results = {
    synced: 0,
    failed: 0,
    daysProcessed: isBackfill ? datesToSync.length : 1,
    isBackfill,
    errors: [] as { connectionId: string; date?: string; error: string }[],
  }

  if (isBackfill) {
    console.log('[Cron Info]', {
      type: 'backfill_started',
      timestamp: new Date().toISOString(),
      startDate: startDate?.toISOString().split('T')[0],
      endDate: endDate?.toISOString().split('T')[0],
      totalDays: datesToSync.length,
      connections: connections?.length || 0,
    })
  }

  // Helper to sync a single connection for a specific date (or yesterday if undefined)
  async function syncConnection(
    connection: NonNullable<typeof connections>[number],
    targetDate?: Date
  ) {
    switch (connection.platform_type) {
      case 'linkedin':
        await syncMetricsForLinkedInConnection(
          connection.id,
          connection.organization_id,
          connection.credentials,
          supabase,
          targetDate
        )
        break
      case 'google_analytics':
        await syncMetricsForGoogleAnalyticsConnection(
          connection.id,
          connection.organization_id,
          connection.credentials,
          supabase,
          targetDate
        )
        break
      case 'hubspot':
        await syncMetricsForHubSpotConnection(
          connection.id,
          connection.organization_id,
          connection.credentials,
          supabase,
          targetDate
        )
        break
      default:
        // Skip unsupported platform types - don't count as synced
        return false
    }
    return true
  }

  for (const connection of connections || []) {
    if (isBackfill) {
      // Backfill mode: sync each date in the range
      for (const targetDate of datesToSync) {
        try {
          const synced = await syncConnection(connection, targetDate)
          if (synced) results.synced++
        } catch (err) {
          results.failed++
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          results.errors.push({
            connectionId: connection.id,
            date: targetDate.toISOString().split('T')[0],
            error: errorMessage,
          })
          console.error('[Cron Error]', {
            type: 'sync_connection_failed',
            connectionId: connection.id,
            platformType: connection.platform_type,
            date: targetDate.toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            error: errorMessage,
          })
        }
      }
    } else {
      // Daily mode: sync yesterday only (no date = default behavior)
      try {
        const synced = await syncConnection(connection)
        if (synced) results.synced++
      } catch (err) {
        results.failed++
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push({
          connectionId: connection.id,
          error: errorMessage,
        })
        console.error('[Cron Error]', {
          type: 'sync_connection_failed',
          connectionId: connection.id,
          platformType: connection.platform_type,
          timestamp: new Date().toISOString(),
          error: errorMessage,
        })
      }
    }
  }

  console.log('[Cron Info]', {
    type: isBackfill ? 'backfill_completed' : 'daily_metrics_sync_completed',
    timestamp: new Date().toISOString(),
    results: {
      synced: results.synced,
      failed: results.failed,
      daysProcessed: results.daysProcessed,
    },
  })

  return NextResponse.json(results)
}
