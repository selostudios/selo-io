'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import { LinkedInClient } from './client'
import { classifyPost } from './classify-post'
import { computeEngagementRate } from './engagement'
import { downloadThumbnails, type ThumbnailJob } from './download-thumbnails'
import { LinkedInPostType } from './post-types'
import { decryptCredentials } from '@/lib/utils/crypto'
import { getYesterdayRange, getSyncDateRange } from '@/lib/utils/date-ranges'
import { getMetricsFromDb, isCacheValid, upsertMetricsAndUpdateSync } from '@/lib/metrics/queries'
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
  const adapter = new LinkedInAdapter(credentials, connectionId, supabase)

  const { start: syncDate, end: endDate } = getSyncDateRange(targetDate)

  const dailyMetrics = await adapter.fetchDailyMetrics(syncDate, endDate)

  if (!dailyMetrics || Object.keys(dailyMetrics).length === 0) {
    console.warn('[LinkedIn Sync] Warning: No data returned from LinkedIn API', {
      connectionId,
      syncDate: syncDate.toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    })
  }

  const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, organizationId)

  await upsertMetricsAndUpdateSync(supabase, records, connectionId)
}

export async function syncLinkedInMetrics(organizationId?: string) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Resolve organization: use provided orgId or fall back to first membership
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

  // Get LinkedIn connection
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', orgId)
    .eq('platform_type', 'linkedin')
    .single()

  if (!connection) {
    return { error: 'LinkedIn not connected' }
  }

  try {
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new LinkedInAdapter(credentials, connection.id)

    // Fetch only yesterday's metrics (use backfill script for historical data)
    const { start: yesterday, end: endDate } = getYesterdayRange()

    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, orgId)

    await upsertMetricsAndUpdateSync(supabase, records, connection.id)

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

  if (!connectionId) {
    return { error: 'Connection ID is required' }
  }

  // Query connection directly by ID — RLS ensures user can only access their org's connections
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials, organization_id')
    .eq('id', connectionId)
    .eq('platform_type', 'linkedin')
    .single()

  if (!connection) {
    return { error: 'LinkedIn not connected' }
  }

  const orgId = connection.organization_id

  try {
    // 1. Try DB cache first
    const cached = await getMetricsFromDb(supabase, orgId, 'linkedin', period)

    // 2. If fresh (< 1 hour), use DB data
    if (isCacheValid(cached)) {
      return formatLinkedInMetricsFromDb(cached, period)
    }

    // 3. Cache is stale - sync yesterday's daily data
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new LinkedInAdapter(credentials, connection.id)

    const { start: yesterday, end: endDate } = getYesterdayRange()

    const dailyMetrics = await adapter.fetchDailyMetrics(yesterday, endDate)
    const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, orgId)

    await upsertMetricsAndUpdateSync(supabase, records, connection.id)

    // Re-fetch from DB to get all data including the fresh sync
    const updatedCache = await getMetricsFromDb(supabase, orgId, 'linkedin', period)
    return formatLinkedInMetricsFromDb(updatedCache, period)
  } catch (error) {
    console.error('[LinkedIn Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}

/**
 * Sync recent LinkedIn organization posts into the `linkedin_posts` table,
 * refresh analytics counters, and backfill thumbnails for image posts.
 *
 * Pipeline: list posts (95d window) → upsert rows → fetch per-post analytics
 * → update engagement_rate/counters → resolve + download image thumbnails.
 *
 * Intended for use by the daily cron. Swallows all errors (logs via
 * `console.error`) so a single org's failure can't halt the cron loop.
 */
export async function syncLinkedInPosts(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const credentials = getCredentials(storedCredentials)
    const client = new LinkedInClient(credentials, connectionId, supabase)

    const since = new Date(Date.now() - 95 * 86_400_000)
    const orgUrn = `urn:li:organization:${credentials.organization_id}`

    const rawPosts = await client.listPosts({ orgUrn, since })

    // Build a map urn -> classified so we can reuse imageUrn later for thumbnails.
    const classifiedByUrn = new Map<string, ReturnType<typeof classifyPost>>()
    const rows: Array<Record<string, unknown>> = []
    for (const raw of rawPosts) {
      if (typeof raw.createdAt !== 'number') continue
      const classified = classifyPost(raw)
      classifiedByUrn.set(raw.id, classified)
      rows.push({
        organization_id: organizationId,
        platform_connection_id: connectionId,
        linkedin_urn: raw.id,
        posted_at: new Date(raw.createdAt).toISOString(),
        caption: classified.caption,
        post_url: classified.postUrl,
        post_type: classified.postType,
      })
    }

    if (rows.length === 0) {
      return
    }

    const { error: upsertError } = await supabase
      .from('linkedin_posts')
      .upsert(rows, { onConflict: 'organization_id,linkedin_urn' })

    if (upsertError) {
      console.error('[LinkedIn Posts Sync] Upsert failed', {
        type: 'posts_upsert_error',
        connectionId,
        organizationId,
        error: upsertError instanceof Error ? upsertError.message : String(upsertError),
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Re-read so we know which just-upserted posts still need thumbnails
    // (new posts have thumbnail_path = null).
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const justUpsertedUrns = rows.map((r) => r.linkedin_urn as string)
    const { data: analyticsRows } = await supabase
      .from('linkedin_posts')
      .select('linkedin_urn, posted_at, post_type, thumbnail_path')
      .eq('organization_id', organizationId)
      .gte('posted_at', ninetyDaysAgo)
      .in('linkedin_urn', justUpsertedUrns)

    const analyticsRowList =
      (analyticsRows as Array<{
        linkedin_urn: string
        posted_at: string
        post_type: string
        thumbnail_path: string | null
      }> | null) ?? []

    const urns = analyticsRowList.map((r) => r.linkedin_urn)
    const analytics = urns.length > 0 ? await client.getPostAnalytics(urns) : new Map()

    const analyticsUpdatedAt = new Date().toISOString()
    await Promise.all(
      analyticsRowList.map(async (row) => {
        const counters = analytics.get(row.linkedin_urn)
        if (!counters) return
        const engagementRate = computeEngagementRate(counters)
        const { error } = await supabase
          .from('linkedin_posts')
          .update({
            impressions: counters.impressions,
            reactions: counters.reactions,
            comments: counters.comments,
            shares: counters.shares,
            engagement_rate: engagementRate,
            analytics_updated_at: analyticsUpdatedAt,
          })
          .match({ organization_id: organizationId, linkedin_urn: row.linkedin_urn })
        if (error) {
          console.error('[LinkedIn Posts Sync] analytics update failed', {
            type: 'posts_analytics_update_error',
            organizationId,
            linkedinUrn: row.linkedin_urn,
            error: error.message,
            timestamp: new Date().toISOString(),
          })
        }
      })
    )

    // Build thumbnail jobs for image posts missing a stored thumbnail.
    const thumbnailCandidates = analyticsRowList.filter(
      (row) => row.post_type === LinkedInPostType.Image && row.thumbnail_path == null
    )
    const thumbnailJobs: ThumbnailJob[] = []
    for (const row of thumbnailCandidates) {
      const classified = classifiedByUrn.get(row.linkedin_urn)
      const imageUrn = classified?.imageUrn ?? null
      if (!imageUrn) continue
      const cdnUrl = await client.resolveImageUrl(imageUrn)
      if (!cdnUrl) continue
      thumbnailJobs.push({
        organizationId,
        linkedinUrn: row.linkedin_urn,
        imageCdnUrl: cdnUrl,
      })
    }

    if (thumbnailJobs.length > 0) {
      const thumbMap = await downloadThumbnails(supabase, thumbnailJobs)
      await Promise.all(
        Array.from(thumbMap).map(async ([linkedinUrn, path]) => {
          const { error } = await supabase
            .from('linkedin_posts')
            .update({ thumbnail_path: path })
            .match({ organization_id: organizationId, linkedin_urn: linkedinUrn })
          if (error) {
            console.error('[LinkedIn Posts Sync] thumbnail update failed', {
              type: 'posts_thumbnail_update_error',
              organizationId,
              linkedinUrn,
              error: error.message,
              timestamp: new Date().toISOString(),
            })
          }
        })
      )
    }
  } catch (error) {
    console.error('[LinkedIn Posts Sync] Error', {
      type: 'posts_sync_error',
      connectionId,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
