'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import type { LinkedInCredentials } from './types'

export async function syncLinkedInMetrics() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
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
    const adapter = new LinkedInAdapter(credentials, connection.id)

    // Fetch metrics for the last 90 days to cover all time ranges
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const metrics = await adapter.fetchMetrics(startDate, endDate)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, endDate)

    // Upsert metrics (delete existing for today, insert new)
    const today = endDate.toISOString().split('T')[0]

    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'linkedin')
      .eq('date', today)

    const { error: insertError } = await supabase
      .from('campaign_metrics')
      .insert(records)

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
    if (error instanceof Error && error.message.includes('401')) {
      return { error: 'LinkedIn token expired. Please reconnect.' }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}

export async function getLinkedInMetrics(period: '7d' | '30d' | 'quarter') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  // Import date utilities
  const { getDateRange, getPreviousPeriodRange, calculatePercentageChange } = await import('@/lib/utils/date-ranges')

  const currentRange = getDateRange(period)
  const previousRange = getPreviousPeriodRange(currentRange, period)

  // Fetch current period metrics
  const { data: currentMetrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .gte('date', currentRange.start.toISOString().split('T')[0])
    .lte('date', currentRange.end.toISOString().split('T')[0])

  // Fetch previous period metrics
  const { data: previousMetrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .gte('date', previousRange.start.toISOString().split('T')[0])
    .lte('date', previousRange.end.toISOString().split('T')[0])

  // Aggregate by metric type
  const aggregate = (metrics: Array<{ metric_type: string; value: number }> | null) => {
    const result: Record<string, number> = {}
    metrics?.forEach(m => {
      result[m.metric_type] = (result[m.metric_type] || 0) + Number(m.value)
    })
    return result
  }

  const current = aggregate(currentMetrics)
  const previous = aggregate(previousMetrics)

  const metricTypes = [
    { key: 'linkedin_followers', label: 'New followers' },
    { key: 'linkedin_page_views', label: 'Page views' },
    { key: 'linkedin_unique_visitors', label: 'Unique visitors' },
    { key: 'linkedin_impressions', label: 'Impressions' },
    { key: 'linkedin_reactions', label: 'Reactions' },
  ]

  const result = metricTypes.map(({ key, label }) => ({
    label,
    value: current[key] || 0,
    change: calculatePercentageChange(current[key] || 0, previous[key] || 0),
  }))

  return { metrics: result }
}
