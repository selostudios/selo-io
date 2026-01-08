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

  // Calculate date range for comparison
  const now = new Date()
  const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const periodStart = new Date(now)
  periodStart.setDate(periodStart.getDate() - daysBack)

  // Get latest metrics (most recent date)
  const { data: latestMetrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value, date')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .order('date', { ascending: false })
    .limit(10) // Get enough to cover all metric types

  // Get metrics from the start of the period for comparison
  const { data: periodStartMetrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value, date')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .lte('date', periodStart.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(10)

  // Build maps for latest and period start values
  const latestMap: Record<string, number> = {}
  const periodStartMap: Record<string, number> = {}

  // Get the most recent value for each metric type
  latestMetrics?.forEach((m) => {
    if (!(m.metric_type in latestMap)) {
      latestMap[m.metric_type] = Number(m.value)
    }
  })

  periodStartMetrics?.forEach((m) => {
    if (!(m.metric_type in periodStartMap)) {
      periodStartMap[m.metric_type] = Number(m.value)
    }
  })

  // Calculate change (current - previous, as a delta not percentage)
  const calculateChange = (current: number, previous: number | undefined): number | null => {
    if (previous === undefined || previous === 0) return null
    // Return percentage change
    return Math.round(((current - previous) / previous) * 100)
  }

  // Only show metrics available without MDP access
  const metricTypes = [
    { key: 'linkedin_followers', label: 'Followers' },
    { key: 'linkedin_reactions', label: 'Engagements' },
  ]

  const result = metricTypes.map(({ key, label }) => ({
    label,
    value: latestMap[key] || 0,
    change: calculateChange(latestMap[key] || 0, periodStartMap[key]),
  }))

  return { metrics: result }
}
