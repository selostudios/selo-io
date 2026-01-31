'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import { decryptCredentials } from '@/lib/utils/crypto'
import { getMetricsFromDb, isCacheValid } from '@/lib/metrics/queries'
import { calculateTrendFromDb, buildTimeSeriesArray } from '@/lib/metrics/helpers'
import { LINKEDIN_METRICS } from '@/lib/metrics/types'
import type { LinkedInCredentials } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Period, MetricTimeSeries } from '@/lib/metrics/types'

interface StoredCredentials {
  encrypted?: string
  access_token?: string
  refresh_token?: string
  organization_id?: string
}

function getCredentials(stored: StoredCredentials): LinkedInCredentials {
  // Handle encrypted credentials (new format)
  if (stored.encrypted) {
    return decryptCredentials<LinkedInCredentials>(stored.encrypted)
  }
  // Handle legacy unencrypted credentials
  return stored as LinkedInCredentials
}

/**
 * Service-level sync function for use by cron jobs (no user auth required).
 * Fetches metrics from LinkedIn API and stores them in the database.
 * @param targetDate - Optional specific date to sync. Defaults to yesterday.
 */
export async function syncMetricsForLinkedInConnection(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient,
  targetDate?: Date
): Promise<void> {
  const credentials = getCredentials(storedCredentials)
  const adapter = new LinkedInAdapter(credentials, connectionId)

  // Use provided date or default to yesterday
  const syncDate = targetDate ? new Date(targetDate) : new Date()
  if (!targetDate) {
    syncDate.setDate(syncDate.getDate() - 1)
  }
  syncDate.setHours(0, 0, 0, 0)
  const endDate = new Date(syncDate)
  endDate.setHours(23, 59, 59, 999)

  const dailyMetrics = await adapter.fetchDailyMetrics(syncDate, endDate)
  const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, organizationId)

  // Store daily snapshots for time-series tracking (upsert to avoid duplicates)
  const { error: insertError } = await supabase
    .from('campaign_metrics')
    .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

  if (insertError) {
    throw new Error(`Failed to save LinkedIn metrics: ${insertError.message}`)
  }

  // Update last_sync_at
  await supabase
    .from('platform_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectionId)
}

export async function syncLinkedInMetrics() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { error: 'User not found' }
  }

  // Get LinkedIn connection
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .single()

  if (!connection) {
    return { error: 'LinkedIn not connected' }
  }

  try {
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new LinkedInAdapter(credentials, connection.id)

    // Fetch only yesterday's metrics (use backfill script for historical data)
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

    // Store daily snapshots for time-series tracking (upsert to avoid duplicates)
    const { error: insertError } = await supabase
      .from('campaign_metrics')
      .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

    if (insertError) {
      console.error('[LinkedIn Sync Error]', insertError)
      return { error: `Failed to save metrics: ${insertError.message}` }
    }

    // Update last_sync_at
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('[LinkedIn Sync Error]', error)
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return { error: 'LinkedIn token expired. Please reconnect.' }
      }
      return { error: error.message }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}

/**
 * Format DB metrics into the response shape expected by the UI.
 */
function formatLinkedInMetricsFromDb(
  cached: { metrics: Array<{ date: string; metric_type: string; value: number }> },
  period: Period
): {
  metrics: Array<{ label: string; value: number; change: number | null }>
  timeSeries: MetricTimeSeries[]
} {
  const followerGrowth = calculateTrendFromDb(cached.metrics, 'linkedin_follower_growth', period)
  const impressions = calculateTrendFromDb(cached.metrics, 'linkedin_impressions', period)
  const reactions = calculateTrendFromDb(cached.metrics, 'linkedin_reactions', period)
  const pageViews = calculateTrendFromDb(cached.metrics, 'linkedin_page_views', period)
  const uniqueVisitors = calculateTrendFromDb(cached.metrics, 'linkedin_unique_visitors', period)

  return {
    metrics: [
      { label: 'New Followers', value: followerGrowth.current, change: followerGrowth.change },
      { label: 'Impressions', value: impressions.current, change: impressions.change },
      { label: 'Reactions', value: reactions.current, change: reactions.change },
      { label: 'Page Views', value: pageViews.current, change: pageViews.change },
      { label: 'Unique Visitors', value: uniqueVisitors.current, change: uniqueVisitors.change },
    ],
    timeSeries: buildTimeSeriesArray(cached.metrics, LINKEDIN_METRICS, period),
  }
}

export async function getLinkedInMetrics(period: Period, connectionId?: string) {
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

  // Get LinkedIn connection - by ID if provided, otherwise first one for org
  let connectionQuery = supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')

  if (connectionId) {
    connectionQuery = connectionQuery.eq('id', connectionId)
  }

  const { data: connection } = await connectionQuery.single()

  if (!connection) {
    return { error: 'LinkedIn not connected' }
  }

  try {
    // 1. Try DB cache first
    const cached = await getMetricsFromDb(supabase, userRecord.organization_id, 'linkedin', period)

    // 2. If fresh (< 1 hour), use DB data
    if (isCacheValid(cached)) {
      return formatLinkedInMetricsFromDb(cached, period)
    }

    // 3. Cache is stale - sync yesterday's daily data (not accumulated period data)
    // This correctly stores single-day values instead of the old buggy behavior
    // that stored accumulated period totals as single-day values
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new LinkedInAdapter(credentials, connection.id)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)

    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, userRecord.organization_id)

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
      'linkedin',
      period
    )
    return formatLinkedInMetricsFromDb(updatedCache, period)
  } catch (error) {
    console.error('[LinkedIn Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}
