#!/usr/bin/env tsx
/**
 * One-time script to backfill Google Analytics metrics from Jan 22-27, 2026
 * Usage: npx tsx scripts/backfill-ga-metrics.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '@/lib/supabase/server'
import { syncMetricsForGoogleAnalyticsConnection } from '@/lib/platforms/google-analytics/actions'

const connectionId = 'b41f7c2d-838b-4c38-978b-b139571d845e'
const organizationId = '2b30d29a-8e88-4d7d-936e-7f6a70d3c3a8'

async function main() {
  console.log('🔄 Starting Google Analytics backfill...')
  console.log('Connection ID:', connectionId)
  console.log('Organization ID:', organizationId)
  console.log('Date range: Last 90 days (including Jan 22-27)')

  const supabase = createServiceClient()

  // Get connection with credentials
  const { data: connection, error: fetchError } = await supabase
    .from('platform_connections')
    .select('credentials')
    .eq('id', connectionId)
    .single()

  if (fetchError || !connection) {
    console.error('❌ Failed to fetch connection:', fetchError)
    process.exit(1)
  }

  console.log('✅ Fetched connection credentials')

  try {
    await syncMetricsForGoogleAnalyticsConnection(
      connectionId,
      organizationId,
      connection.credentials,
      supabase
    )

    console.log('✅ Backfill completed successfully!')
    console.log('📊 Daily metrics stored for last 90 days')

    // Query to verify
    const { count } = await supabase
      .from('campaign_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('platform_type', 'google_analytics')
      .gte('date', '2026-01-22')
      .lte('date', '2026-01-27')

    console.log(`✅ Stored ${count} metric records for Jan 22-27`)
  } catch (error) {
    console.error('❌ Backfill failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

main()
