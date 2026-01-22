'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { HubSpotAdapter } from './adapter'
import type { HubSpotCredentials } from './types'

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

type Period = '7d' | '30d' | 'quarter'

function getPeriodDays(period: Period): number {
  switch (period) {
    case '7d':
      return 7
    case '30d':
      return 30
    case 'quarter':
      return 90
  }
}

function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
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
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new HubSpotAdapter(credentials, connection.id)
    const days = getPeriodDays(period)

    // Calculate date ranges for current and previous periods
    const currentEnd = new Date()
    const currentStart = new Date()
    currentStart.setDate(currentStart.getDate() - days)

    const previousEnd = new Date(currentStart)
    previousEnd.setDate(previousEnd.getDate() - 1)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - days + 1)

    // Fetch metrics for both periods
    const [currentMetrics, previousMetrics] = await Promise.all([
      adapter.fetchMetrics(currentStart, currentEnd),
      adapter.fetchMetrics(previousStart, previousEnd),
    ])

    // Add change calculations to metrics
    const metrics = {
      crm: {
        ...currentMetrics.crm,
        newDealsChange: calculateChange(currentMetrics.crm.newDeals, previousMetrics.crm.newDeals),
        dealsWonChange: calculateChange(currentMetrics.crm.dealsWon, previousMetrics.crm.dealsWon),
        dealsLostChange: calculateChange(
          currentMetrics.crm.dealsLost,
          previousMetrics.crm.dealsLost
        ),
      },
      marketing: {
        ...currentMetrics.marketing,
        formSubmissionsChange: calculateChange(
          currentMetrics.marketing.formSubmissions,
          previousMetrics.marketing.formSubmissions
        ),
      },
    }

    return { metrics }
  } catch (error) {
    console.error('[HubSpot Metrics Error]', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to fetch HubSpot metrics' }
  }
}
