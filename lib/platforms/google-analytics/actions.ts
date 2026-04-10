'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleAnalyticsAdapter } from './adapter'
import { decryptCredentials } from '@/lib/utils/crypto'
import { getYesterdayRange, getSyncDateRange } from '@/lib/utils/date-ranges'
import { getMetricsFromDb, isCacheValid, upsertMetricsAndUpdateSync } from '@/lib/metrics/queries'
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
  const adapter = new GoogleAnalyticsAdapter(credentials, connectionId, supabase)

  const { start: syncDate, end: endDate } = getSyncDateRange(targetDate)

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

  console.error(
    '[GA Sync] Storing',
    records.length,
    'metric records for',
    dailyMetrics.length,
    'days'
  )

  await upsertMetricsAndUpdateSync(supabase, records, connectionId)
}

export async function syncGoogleAnalyticsMetrics(organizationId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  let orgId = organizationId
  if (!orgId) {
    const { data: rawUser } = await supabase
      .from('users')
      .select('id, team_members(organization_id)')
      .eq('id', user.id)
      .single()

    orgId =
      (rawUser?.team_members as { organization_id: string }[])?.[0]?.organization_id ?? undefined
  }

  if (!orgId) {
    return { error: 'User not found' }
  }

  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', orgId)
    .eq('platform_type', 'google_analytics')
    .single()

  if (!connection) {
    return { error: 'Google Analytics not connected' }
  }

  try {
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new GoogleAnalyticsAdapter(credentials, connection.id)

    // Fetch only yesterday's metrics (use backfill script for historical data)
    const { start: yesterday, end: endDate } = getYesterdayRange()

    // Fetch daily breakdowns
    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, orgId)

    await upsertMetricsAndUpdateSync(supabase, records, connection.id)

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

  if (!connectionId) {
    return { error: 'Connection ID is required' }
  }

  // Query connection directly by ID — RLS ensures user can only access their org's connections
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials, organization_id')
    .eq('id', connectionId)
    .eq('platform_type', 'google_analytics')
    .single()

  if (!connection) {
    return { error: 'Google Analytics not connected' }
  }

  const orgId = connection.organization_id

  try {
    // 1. Try DB cache first
    const cached = await getMetricsFromDb(supabase, orgId, 'google_analytics', period)

    // 2. If fresh (< 1 hour), use DB data
    if (isCacheValid(cached)) {
      return formatGAMetricsFromDb(cached, period)
    }

    // 3. Cache is stale - sync yesterday's daily data
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new GoogleAnalyticsAdapter(credentials, connection.id)

    const { start: yesterday, end: endDate } = getYesterdayRange()

    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, orgId)

    await upsertMetricsAndUpdateSync(supabase, records, connection.id)

    // Re-fetch from DB to get all data including the fresh sync
    const updatedCache = await getMetricsFromDb(supabase, orgId, 'google_analytics', period)
    return formatGAMetricsFromDb(updatedCache, period)
  } catch (error) {
    console.error('[GA Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch Google Analytics metrics' }
  }
}
