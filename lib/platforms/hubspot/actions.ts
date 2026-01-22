'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { HubSpotAdapter } from './adapter'
import { getMetricsFromDb, isCacheValid } from '@/lib/metrics/queries'
import {
  calculateTrendFromDb,
  buildTimeSeriesArray,
  getDateRanges,
  calculateChange,
} from '@/lib/metrics/helpers'
import { HUBSPOT_METRICS } from '@/lib/metrics/types'
import type { HubSpotCredentials } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Period, MetricTimeSeries } from '@/lib/metrics/types'

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
 */
export async function syncMetricsForHubSpotConnection(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient
): Promise<void> {
  const credentials = getCredentials(storedCredentials)
  const adapter = new HubSpotAdapter(credentials, connectionId)

  const metrics = await adapter.fetchMetrics()
  const records = adapter.normalizeToDbRecords(metrics, organizationId, new Date())

  const today = new Date().toISOString().split('T')[0]

  await supabase
    .from('campaign_metrics')
    .delete()
    .eq('organization_id', organizationId)
    .eq('platform_type', 'hubspot')
    .eq('date', today)

  const { error: insertError } = await supabase.from('campaign_metrics').insert(records)

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

    const metrics = await adapter.fetchMetrics()
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, new Date())

    const today = new Date().toISOString().split('T')[0]

    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'hubspot')
      .eq('date', today)

    const { error: insertError } = await supabase.from('campaign_metrics').insert(records)

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
  const totalPipelineValue = calculateTrendFromDb(cached.metrics, 'hubspot_total_pipeline_value', period, true)

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

export async function getHubSpotMetrics(period: Period = '30d') {
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
    // 1. Try DB cache first
    const cached = await getMetricsFromDb(supabase, userRecord.organization_id, 'hubspot', period)

    // 2. If fresh (< 1 hour), use DB data
    if (isCacheValid(cached)) {
      return formatHubSpotMetricsFromDb(cached, period)
    }

    // 3. Otherwise, fetch fresh from API
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period)

    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new HubSpotAdapter(credentials, connection.id)

    const [currentMetrics, previousMetrics] = await Promise.all([
      adapter.fetchMetrics(currentStart, currentEnd),
      adapter.fetchMetrics(previousStart, previousEnd),
    ])

    // 4. Store to DB (today's snapshot)
    const records = adapter.normalizeToDbRecords(currentMetrics, userRecord.organization_id, new Date())
    const today = new Date().toISOString().split('T')[0]

    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'hubspot')
      .eq('date', today)

    await supabase.from('campaign_metrics').insert(records)

    // Update last_sync_at
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    // 5. Return fresh data
    const timeSeries = HUBSPOT_METRICS.map((def) => ({
      metricType: def.metricType,
      label: def.label,
      data: [{ date: today, value: records.find((r) => r.metric_type === def.metricType)?.value ?? 0 }],
    }))

    return {
      metrics: {
        crm: {
          ...currentMetrics.crm,
          newDealsChange: calculateChange(currentMetrics.crm.newDeals, previousMetrics.crm.newDeals),
          dealsWonChange: calculateChange(currentMetrics.crm.dealsWon, previousMetrics.crm.dealsWon),
          dealsLostChange: calculateChange(currentMetrics.crm.dealsLost, previousMetrics.crm.dealsLost),
        },
        marketing: {
          ...currentMetrics.marketing,
          formSubmissionsChange: calculateChange(
            currentMetrics.marketing.formSubmissions,
            previousMetrics.marketing.formSubmissions
          ),
        },
      },
      timeSeries,
    }
  } catch (error) {
    console.error('[HubSpot Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch HubSpot metrics' }
  }
}
