'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import { decryptCredentials } from '@/lib/utils/crypto'
import type { LinkedInCredentials } from './types'

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

    // Fetch metrics for the last 90 days to cover all time ranges
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const metrics = await adapter.fetchMetrics(startDate, endDate)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, endDate)

    // Store daily snapshots for time-series tracking
    // Delete only today's records, keep history for trend analysis
    const today = new Date().toISOString().split('T')[0]

    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'linkedin')
      .eq('date', today)

    const { error: insertError } = await supabase.from('campaign_metrics').insert(records)

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
      if (error.message.includes('permissions missing') || error.message.includes('access denied')) {
        return {
          error: 'LinkedIn permissions missing. Please disconnect and reconnect your LinkedIn account in Settings → Integrations.',
          needsReconnect: true,
        }
      }
      if (error.message.includes('token expired') || error.message.includes('401')) {
        return {
          error: 'LinkedIn token expired. Please reconnect your account.',
          needsReconnect: true,
        }
      }
      return { error: error.message }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}

export async function getLinkedInMetrics(period: '7d' | '30d' | 'quarter') {
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
    // Calculate date range based on period
    const endDate = new Date()
    const startDate = new Date()
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90
    startDate.setDate(startDate.getDate() - daysBack)

    // Fetch fresh metrics from LinkedIn for the selected period
    const credentials = getCredentials(connection.credentials as StoredCredentials)
    const adapter = new LinkedInAdapter(credentials, connection.id)
    const metrics = await adapter.fetchMetrics(startDate, endDate)

    // All metrics are now period-specific based on the selected date range
    const result = [
      { label: 'New Followers', value: metrics.followerGrowth, change: null },
      { label: 'Impressions', value: metrics.impressions, change: null },
      { label: 'Reactions', value: metrics.reactions, change: null },
      { label: 'Page Views', value: metrics.pageViews, change: null },
      { label: 'Unique Visitors', value: metrics.uniqueVisitors, change: null },
    ]

    return { metrics: result }
  } catch (error) {
    console.error('[LinkedIn Metrics Error]', error)
    if (error instanceof Error) {
      // Check for permission errors and provide actionable message
      if (error.message.includes('permissions missing') || error.message.includes('access denied')) {
        return {
          error: 'LinkedIn permissions missing. Please disconnect and reconnect your LinkedIn account in Settings → Integrations.',
          needsReconnect: true,
        }
      }
      if (error.message.includes('token expired') || error.message.includes('401')) {
        return {
          error: 'LinkedIn token expired. Please reconnect your account.',
          needsReconnect: true,
        }
      }
      return { error: error.message }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}
