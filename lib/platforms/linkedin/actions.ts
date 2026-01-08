'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import type { LinkedInCredentials } from './types'

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

  const credentials = connection.credentials as LinkedInCredentials

  try {
    const adapter = new LinkedInAdapter(credentials)

    // Fetch metrics for the last 90 days to cover all time ranges
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const metrics = await adapter.fetchMetrics(startDate, endDate)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, endDate)

    // Delete ALL existing LinkedIn metrics and insert fresh snapshot
    // (LinkedIn API returns totals, not daily deltas)
    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'linkedin')

    const { error: insertError } = await supabase.from('campaign_metrics').insert(records)

    if (insertError) {
      console.error('[LinkedIn Sync Error]', insertError)
      return { error: 'Failed to save metrics' }
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getLinkedInMetrics(_period: '7d' | '30d' | 'quarter') {
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

  // Fetch latest metrics (we store snapshots, not time-series)
  const { data: metrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')

  // Build metrics map
  const metricsMap: Record<string, number> = {}
  metrics?.forEach((m) => {
    metricsMap[m.metric_type] = Number(m.value)
  })

  // Only show metrics available without MDP access
  const metricTypes = [
    { key: 'linkedin_followers', label: 'Followers' },
    { key: 'linkedin_reactions', label: 'Engagements' },
  ]

  const result = metricTypes.map(({ key, label }) => ({
    label,
    value: metricsMap[key] || 0,
    change: null, // No historical data for snapshots
  }))

  return { metrics: result }
}
