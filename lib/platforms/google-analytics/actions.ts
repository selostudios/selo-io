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
    const endDate = new Date()
    const startDate = new Date()
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90
    startDate.setDate(startDate.getDate() - daysBack)

    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new GoogleAnalyticsAdapter(credentials, connection.id)
    const metrics = await adapter.fetchMetrics(startDate, endDate)

    return {
      metrics: {
        activeUsers: metrics.activeUsers,
        newUsers: metrics.newUsers,
        sessions: metrics.sessions,
        trafficAcquisition: metrics.trafficAcquisition,
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
