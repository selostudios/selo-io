'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import { decryptCredentials } from '@/lib/utils/crypto'
import { getMetricsFromDb, isCacheValid } from '@/lib/metrics/queries'
import {
  calculateTrendFromDb,
  buildTimeSeriesArray,
  getDateRanges,
  calculateChange,
} from '@/lib/metrics/helpers'
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
 * Only syncs yesterday's data since cron runs daily (use backfill script for historical data).
 */
export async function syncMetricsForLinkedInConnection(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient
): Promise<void> {
  const credentials = getCredentials(storedCredentials)
  const adapter = new LinkedInAdapter(credentials, connectionId)

  // Fetch only yesterday's metrics (cron runs daily)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const endDate = new Date(yesterday)
  endDate.setHours(23, 59, 59, 999)

  const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
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
    const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, userRecord.organization_id)

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

    // 3. Otherwise, fetch fresh from API
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period)

    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new LinkedInAdapter(credentials, connection.id)

    const [currentMetrics, previousMetrics] = await Promise.all([
      adapter.fetchMetrics(currentStart, currentEnd),
      adapter.fetchMetrics(previousStart, previousEnd),
    ])

    // 4. Store to DB (today's snapshot, upsert to avoid duplicates)
    const records = adapter.normalizeToDbRecords(
      currentMetrics,
      userRecord.organization_id,
      new Date()
    )

    await supabase
      .from('campaign_metrics')
      .upsert(records, { onConflict: 'organization_id,platform_type,date,metric_type' })

    // Update last_sync_at
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    // 5. Return fresh data with historical time series from DB
    const metrics = [
      {
        label: 'New Followers',
        value: currentMetrics.followerGrowth,
        change: calculateChange(currentMetrics.followerGrowth, previousMetrics.followerGrowth),
      },
      {
        label: 'Impressions',
        value: currentMetrics.impressions,
        change: calculateChange(currentMetrics.impressions, previousMetrics.impressions),
      },
      {
        label: 'Reactions',
        value: currentMetrics.reactions,
        change: calculateChange(currentMetrics.reactions, previousMetrics.reactions),
      },
      {
        label: 'Page Views',
        value: currentMetrics.pageViews,
        change: calculateChange(currentMetrics.pageViews, previousMetrics.pageViews),
      },
      {
        label: 'Unique Visitors',
        value: currentMetrics.uniqueVisitors,
        change: calculateChange(currentMetrics.uniqueVisitors, previousMetrics.uniqueVisitors),
      },
    ]

    // Re-query DB for historical time series (now includes fresh data)
    const updatedCache = await getMetricsFromDb(
      supabase,
      userRecord.organization_id,
      'linkedin',
      period
    )
    const timeSeries = buildTimeSeriesArray(updatedCache.metrics, LINKEDIN_METRICS, period)

    return { metrics, timeSeries }
  } catch (error) {
    console.error('[LinkedIn Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}
