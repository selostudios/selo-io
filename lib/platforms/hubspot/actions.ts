'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { HubSpotAdapter } from './adapter'
import { getMetricsFromDb, isCacheValid } from '@/lib/metrics/queries'
import { calculateTrendFromDb, buildTimeSeriesArray } from '@/lib/metrics/helpers'
import { HUBSPOT_METRICS } from '@/lib/metrics/types'
import type { HubSpotCredentials } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MetricTimeSeries } from '@/lib/metrics/types'
import { Period } from '@/lib/metrics/types'

interface StoredCredentials {
  access_token?: string
  refresh_token?: string
  expires_at?: string
  organization_id?: string
  organization_name?: string
}

function getCredentials(stored: StoredCredentials): HubSpotCredentials {
  return {
    access_token: stored.access_token || '',
    refresh_token: stored.refresh_token || '',
    expires_at: stored.expires_at || '',
    hub_id: stored.organization_id || '',
    hub_domain: stored.organization_name || '',
  }
}

/**
 * Service-level sync function for use by cron jobs (no user auth required).
 * Fetches metrics from HubSpot API and stores them in the database.
 * @param targetDate - Optional specific date to sync. Defaults to yesterday.
 */
export async function syncMetricsForHubSpotConnection(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient,
  targetDate?: Date
): Promise<void> {
  const credentials = getCredentials(storedCredentials)
  const adapter = new HubSpotAdapter(credentials, connectionId)

  // Use provided date or default to yesterday
  const syncDate = targetDate ? new Date(targetDate) : new Date()
  if (!targetDate) {
    syncDate.setDate(syncDate.getDate() - 1)
  }
  syncDate.setHours(0, 0, 0, 0)
  const endDate = new Date(syncDate)
  endDate.setHours(23, 59, 59, 999)

  // Include form submissions in cron sync (expensive but runs once daily)
  const metrics = await adapter.fetchMetrics(syncDate, endDate, 1, true)

  if (!metrics || (metrics.crm.totalContacts === 0 && metrics.crm.totalDeals === 0)) {
    console.warn('[HubSpot Sync] Warning: No data returned from HubSpot API', {
      connectionId,
      syncDate: syncDate.toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    })
  }

  const records = adapter.normalizeToDbRecords(metrics, organizationId, syncDate)

  // Upsert to avoid duplicate entries
  const { error: insertError } = await supabase
    .from('campaign_metrics')
    .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

  if (insertError) {
    throw new Error(`Failed to save HubSpot metrics: ${insertError.message}`)
  }

  await supabase
    .from('platform_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectionId)
}

export async function syncHubSpotMetrics() {
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
    .eq('platform_type', 'hubspot')
    .single()

  if (!connection) {
    return { error: 'HubSpot not connected' }
  }

  try {
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new HubSpotAdapter(credentials, connection.id)

    // Fetch only yesterday's metrics (use backfill script for historical data)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)

    // Include form submissions on manual refresh (user explicitly requested fresh data)
    const metrics = await adapter.fetchMetrics(yesterday, endDate, 1, true)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, yesterday)

    // Upsert to avoid duplicate entries
    const { error: insertError } = await supabase
      .from('campaign_metrics')
      .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

    if (insertError) {
      console.error('[HubSpot Sync Error]', insertError)
      return { error: `Failed to save metrics: ${insertError.message}` }
    }

    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('[HubSpot Sync Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch HubSpot metrics' }
  }
}

interface HubSpotMetricsResponse {
  metrics: {
    crm: {
      totalContacts: number
      totalDeals: number
      newDeals: number
      totalPipelineValue: number
      dealsWon: number
      dealsLost: number
      newDealsChange: number | null
      dealsWonChange: number | null
      dealsLostChange: number | null
    }
    marketing: {
      formSubmissions: number
      formSubmissionsChange: number | null
    }
  }
  timeSeries: MetricTimeSeries[]
}

/**
 * Format DB metrics into the response shape expected by the UI.
 */
function formatHubSpotMetricsFromDb(
  cached: { metrics: Array<{ date: string; metric_type: string; value: number }> },
  period: Period
): HubSpotMetricsResponse {
  // Cumulative metrics (use latest value)
  const totalContacts = calculateTrendFromDb(cached.metrics, 'hubspot_total_contacts', period, true)
  const totalDeals = calculateTrendFromDb(cached.metrics, 'hubspot_total_deals', period, true)
  const totalPipelineValue = calculateTrendFromDb(
    cached.metrics,
    'hubspot_total_pipeline_value',
    period,
    true
  )

  // Period metrics (sum values)
  const newDeals = calculateTrendFromDb(cached.metrics, 'hubspot_new_deals', period)
  const dealsWon = calculateTrendFromDb(cached.metrics, 'hubspot_deals_won', period)
  const dealsLost = calculateTrendFromDb(cached.metrics, 'hubspot_deals_lost', period)
  const formSubmissions = calculateTrendFromDb(cached.metrics, 'hubspot_form_submissions', period)

  return {
    metrics: {
      crm: {
        totalContacts: totalContacts.current,
        totalDeals: totalDeals.current,
        newDeals: newDeals.current,
        totalPipelineValue: totalPipelineValue.current,
        dealsWon: dealsWon.current,
        dealsLost: dealsLost.current,
        newDealsChange: newDeals.change,
        dealsWonChange: dealsWon.change,
        dealsLostChange: dealsLost.change,
      },
      marketing: {
        formSubmissions: formSubmissions.current,
        formSubmissionsChange: formSubmissions.change,
      },
    },
    timeSeries: buildTimeSeriesArray(cached.metrics, HUBSPOT_METRICS, period),
  }
}

export async function getHubSpotMetrics(period: Period = Period.ThirtyDays, connectionId?: string) {
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

  // If connectionId is provided, query by id; otherwise query by organization and platform
  let connectionQuery = supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'hubspot')

  if (connectionId) {
    connectionQuery = connectionQuery.eq('id', connectionId)
  }

  const { data: connection } = await connectionQuery.single()

  if (!connection) {
    return { error: 'HubSpot not connected' }
  }

  try {
    // 1. Try DB cache first
    const cached = await getMetricsFromDb(supabase, userRecord.organization_id, 'hubspot', period)

    // 2. If fresh (< 1 hour), use DB data
    if (isCacheValid(cached)) {
      return formatHubSpotMetricsFromDb(cached, period)
    }

    // 3. Cache is stale - sync yesterday's daily data (not accumulated period data)
    // This correctly stores single-day values instead of the old buggy behavior
    // that stored accumulated period totals as single-day values
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new HubSpotAdapter(credentials, connection.id)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)

    // Fetch yesterday's metrics only
    const metrics = await adapter.fetchMetrics(yesterday, endDate, 1, true)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, yesterday)

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
      'hubspot',
      period
    )
    return formatHubSpotMetricsFromDb(updatedCache, period)
  } catch (error) {
    console.error('[HubSpot Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch HubSpot metrics' }
  }
}
