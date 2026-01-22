'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleAnalyticsAdapter } from './adapter'
import { decryptCredentials } from '@/lib/utils/crypto'
import type { GoogleAnalyticsCredentials } from './types'

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

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const metrics = await adapter.fetchMetrics(startDate, endDate)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, endDate)

    const today = new Date().toISOString().split('T')[0]

    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'google_analytics')
      .eq('date', today)

    const { error: insertError } = await supabase.from('campaign_metrics').insert(records)

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

function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}

export async function getGoogleAnalyticsMetrics(period: '7d' | '30d' | 'quarter') {
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
    // Calculate date ranges for current and previous periods
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90

    // Current period
    const currentEnd = new Date()
    const currentStart = new Date()
    currentStart.setDate(currentStart.getDate() - daysBack)

    // Previous period (same length, immediately before current)
    const previousEnd = new Date(currentStart)
    previousEnd.setDate(previousEnd.getDate() - 1)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - daysBack + 1)

    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new GoogleAnalyticsAdapter(credentials, connection.id)

    const [currentMetrics, previousMetrics] = await Promise.all([
      adapter.fetchMetrics(currentStart, currentEnd),
      adapter.fetchMetrics(previousStart, previousEnd),
    ])

    return {
      metrics: {
        activeUsers: currentMetrics.activeUsers,
        activeUsersChange: calculateChange(currentMetrics.activeUsers, previousMetrics.activeUsers),
        newUsers: currentMetrics.newUsers,
        newUsersChange: calculateChange(currentMetrics.newUsers, previousMetrics.newUsers),
        sessions: currentMetrics.sessions,
        sessionsChange: calculateChange(currentMetrics.sessions, previousMetrics.sessions),
        trafficAcquisition: currentMetrics.trafficAcquisition,
        trafficAcquisitionChanges: {
          direct: calculateChange(
            currentMetrics.trafficAcquisition.direct,
            previousMetrics.trafficAcquisition.direct
          ),
          organicSearch: calculateChange(
            currentMetrics.trafficAcquisition.organicSearch,
            previousMetrics.trafficAcquisition.organicSearch
          ),
          email: calculateChange(
            currentMetrics.trafficAcquisition.email,
            previousMetrics.trafficAcquisition.email
          ),
          organicSocial: calculateChange(
            currentMetrics.trafficAcquisition.organicSocial,
            previousMetrics.trafficAcquisition.organicSocial
          ),
          referral: calculateChange(
            currentMetrics.trafficAcquisition.referral,
            previousMetrics.trafficAcquisition.referral
          ),
        },
      },
    }
  } catch (error) {
    console.error('[GA Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch Google Analytics metrics' }
  }
}
