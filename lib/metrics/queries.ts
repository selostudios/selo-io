import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformType } from '@/lib/platforms/types'
import type { Period, CachedMetricsResult } from './types'
import { getDateRanges, formatDateString } from './helpers'

const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Get metrics from the database with cache freshness check.
 * Returns cached metrics and whether they're fresh (< 1 hour old).
 */
export async function getMetricsFromDb(
  supabase: SupabaseClient,
  organizationId: string,
  platformType: PlatformType,
  period: Period
): Promise<CachedMetricsResult> {
  // Check last_sync_at from platform_connections
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('last_sync_at')
    .eq('organization_id', organizationId)
    .eq('platform_type', platformType)
    .single()

  const lastSyncAt = connection?.last_sync_at || null
  const oneHourAgo = new Date(Date.now() - CACHE_DURATION_MS)
  const isFresh = lastSyncAt !== null && new Date(lastSyncAt) > oneHourAgo

  // Calculate date range to query (need previous period for trend calculation)
  const { previousStart, currentEnd } = getDateRanges(period)
  const startDateStr = formatDateString(previousStart)
  const endDateStr = formatDateString(currentEnd)

  // Query metrics for the full range (current + previous period)
  const { data: metrics } = await supabase
    .from('campaign_metrics')
    .select('date, metric_type, value')
    .eq('organization_id', organizationId)
    .eq('platform_type', platformType)
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .order('date', { ascending: true })

  return {
    metrics: metrics || [],
    isFresh,
    lastSyncAt,
  }
}

/**
 * Check if cached data is fresh (< 1 hour old) and has data.
 */
export function isCacheValid(cached: CachedMetricsResult): boolean {
  return cached.isFresh && cached.metrics.length > 0
}
