'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleAnalyticsAdapter } from './adapter'
import { decryptCredentials } from '@/lib/utils/crypto'
import { getMetricsFromDb, isCacheValid } from '@/lib/metrics/queries'
import { calculateTrendFromDb, buildTimeSeriesArray } from '@/lib/metrics/helpers'
import { GA_METRICS } from '@/lib/metrics/types'
import type { GoogleAnalyticsCredentials, TrafficAcquisition } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Period, MetricTimeSeries } from '@/lib/metrics/types'

interface StoredCredentials {
  encrypted?: string
  access_token?: string
  refresh_token?: string
  expires_at?: string
  // OAuth callback stores these as organization_id/name (generic)
  // but GA needs property_id/name
  property_id?: string
  property_name?: string
  organization_id?: string
  organization_name?: string
}

function getCredentials(stored: StoredCredentials): GoogleAnalyticsCredentials {
  if (stored.encrypted) {
    return decryptCredentials<GoogleAnalyticsCredentials>(stored.encrypted)
  }
  // Map organization_id to property_id (OAuth callback uses generic field names)
  return {
    access_token: stored.access_token || '',
    refresh_token: stored.refresh_token || '',
    expires_at: stored.expires_at || '',
    property_id: stored.property_id || stored.organization_id || '',
    property_name: stored.property_name || stored.organization_name || '',
  }
}

/**
 * Service-level sync function for use by cron jobs (no user auth required).
 * Fetches daily metrics from Google Analytics API and stores them in the database.
 * @param targetDate - Optional specific date to sync. Defaults to yesterday.
 */
export async function syncMetricsForGoogleAnalyticsConnection(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient,
  targetDate?: Date
): Promise<void> {
  const credentials = getCredentials(storedCredentials)
  const adapter = new GoogleAnalyticsAdapter(credentials, connectionId)

  // Use provided date or default to yesterday
  const syncDate = targetDate ? new Date(targetDate) : new Date()
  if (!targetDate) {
    syncDate.setDate(syncDate.getDate() - 1)
  }
  syncDate.setHours(0, 0, 0, 0)
  const endDate = new Date(syncDate)
  endDate.setHours(23, 59, 59, 999)

  // Fetch daily breakdowns
  const dailyMetrics = await adapter.fetchDailyMetrics(syncDate, endDate)

  if (dailyMetrics.length === 0) {
    console.warn('[GA Sync] Warning: No data returned from GA API', {
      connectionId,
      syncDate: syncDate.toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    })
  }

  const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, organizationId)

  console.log(
    '[GA Sync] Storing',
    records.length,
    'metric records for',
    dailyMetrics.length,
    'days'
  )

  // Upsert to avoid duplicate entries
  const { error: insertError } = await supabase
    .from('campaign_metrics')
    .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

  if (insertError) {
    throw new Error(`Failed to save Google Analytics metrics: ${insertError.message}`)
  }

  await supabase
    .from('platform_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectionId)
}

export async function syncGoogleAnalyticsMetrics() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { error: 'User not found' }
  }

  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'google_analytics')
    .single()

  if (!connection) {
    return { error: 'Google Analytics not connected' }
  }

  try {
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new GoogleAnalyticsAdapter(credentials, connection.id)

    // Fetch only yesterday's metrics (use backfill script for historical data)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)

    // Fetch daily breakdowns
    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(
      dailyMetrics,
      userRecord.organization_id
    )

    // Upsert to avoid duplicate entries
    const { error: insertError } = await supabase
      .from('campaign_metrics')
      .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

    if (insertError) {
      console.error('[GA Sync Error]', insertError)
      return { error: `Failed to save metrics: ${insertError.message}` }
    }

    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('[GA Sync Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch Google Analytics metrics' }
  }
}

interface GAMetricsResponse {
  metrics: {
    activeUsers: number
    activeUsersChange: number | null
    newUsers: number
    newUsersChange: number | null
    sessions: number
    sessionsChange: number | null
    trafficAcquisition: TrafficAcquisition
    trafficAcquisitionChanges: {
      direct: number | null
      organicSearch: number | null
      email: number | null
      organicSocial: number | null
      referral: number | null
    }
  }
  timeSeries: MetricTimeSeries[]
}

/**
 * Format DB metrics into the response shape expected by the UI.
 */
function formatGAMetricsFromDb(
  cached: { metrics: Array<{ date: string; metric_type: string; value: number }> },
  period: Period
): GAMetricsResponse {
  const activeUsers = calculateTrendFromDb(cached.metrics, 'ga_active_users', period)
  const newUsers = calculateTrendFromDb(cached.metrics, 'ga_new_users', period)
  const sessions = calculateTrendFromDb(cached.metrics, 'ga_sessions', period)
  const trafficDirect = calculateTrendFromDb(cached.metrics, 'ga_traffic_direct', period)
  const trafficOrganicSearch = calculateTrendFromDb(
    cached.metrics,
    'ga_traffic_organic_search',
    period
  )
  const trafficEmail = calculateTrendFromDb(cached.metrics, 'ga_traffic_email', period)
  const trafficOrganicSocial = calculateTrendFromDb(
    cached.metrics,
    'ga_traffic_organic_social',
    period
  )
  const trafficReferral = calculateTrendFromDb(cached.metrics, 'ga_traffic_referral', period)

  return {
    metrics: {
      activeUsers: activeUsers.current,
      activeUsersChange: activeUsers.change,
      newUsers: newUsers.current,
      newUsersChange: newUsers.change,
      sessions: sessions.current,
      sessionsChange: sessions.change,
      trafficAcquisition: {
        direct: trafficDirect.current,
        organicSearch: trafficOrganicSearch.current,
        email: trafficEmail.current,
        organicSocial: trafficOrganicSocial.current,
        referral: trafficReferral.current,
      },
      trafficAcquisitionChanges: {
        direct: trafficDirect.change,
        organicSearch: trafficOrganicSearch.change,
        email: trafficEmail.change,
        organicSocial: trafficOrganicSocial.change,
        referral: trafficReferral.change,
      },
    },
    timeSeries: buildTimeSeriesArray(cached.metrics, GA_METRICS, period),
  }
}

export async function getGoogleAnalyticsMetrics(period: Period, connectionId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { error: 'User not found' }
  }

  // Build query to find connection
  let connectionQuery = supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'google_analytics')

  // If connectionId provided, filter to that specific connection
  if (connectionId) {
    connectionQuery = connectionQuery.eq('id', connectionId)
  }

  const { data: connection } = await connectionQuery.single()

  if (!connection) {
    return { error: 'Google Analytics not connected' }
  }

  try {
    // 1. Try DB cache first
    const cached = await getMetricsFromDb(
      supabase,
      userRecord.organization_id,
      'google_analytics',
      period
    )

    // 2. If fresh (< 1 hour), use DB data
    if (isCacheValid(cached)) {
      return formatGAMetricsFromDb(cached, period)
    }

    // 3. Cache is stale - sync yesterday's daily data (not accumulated period data)
    // This correctly stores single-day values instead of the old buggy behavior
    // that stored accumulated period totals as single-day values
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new GoogleAnalyticsAdapter(credentials, connection.id)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)

    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(
      dailyMetrics,
      userRecord.organization_id
    )

    await supabase
      .from('campaign_metrics')
      .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    // Re-fetch from DB to get all data including the fresh sync
    const updatedCache = await getMetricsFromDb(
      supabase,
      userRecord.organization_id,
      'google_analytics',
      period
    )
    return formatGAMetricsFromDb(updatedCache, period)
  } catch (error) {
    console.error('[GA Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch Google Analytics metrics' }
  }
}
