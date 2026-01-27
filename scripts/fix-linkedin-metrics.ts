#!/usr/bin/env tsx

import { config } from 'dotenv'
import { resolve } from 'path'
import { createInterface } from 'readline'

// Parse --prod flag early to determine which env file to load
const args = process.argv.slice(2)
const isProd = args.includes('--prod') || args.includes('-p')

// Load environment variables from appropriate file
config({ path: resolve(process.cwd(), isProd ? '.env' : '.env.local') })

import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'
import type { LinkedInCredentials } from '@/lib/platforms/linkedin/types'
import { getOAuthProvider } from '@/lib/oauth/registry'
import { Platform } from '@/lib/oauth/types'

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2)
  const params: {
    date?: string // Single day: --date=2026-01-22
    startDate?: string // Range start: --start=2026-01-22
    endDate?: string // Range end: --end=2026-01-27
    orgId?: string // Optional: --org-id=UUID (if multiple orgs)
    dryRun?: boolean // --dry-run flag
    prod?: boolean // --prod flag for production database
  } = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--date=')) {
      params.date = arg.split('=')[1]
    } else if (arg.startsWith('--start=')) {
      params.startDate = arg.split('=')[1]
    } else if (arg.startsWith('--end=')) {
      params.endDate = arg.split('=')[1]
    } else if (arg.startsWith('--org-id=')) {
      params.orgId = arg.split('=')[1]
    } else if (arg === '--dry-run') {
      params.dryRun = true
    } else if (arg === '--prod' || arg === '-p') {
      params.prod = true
    }
  }

  return params
}

// ============================================================================
// Date Validation
// ============================================================================

function validateDate(dateStr: string): Date {
  // Validate YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`)
  }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`)
  }

  // Ensure not future date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date > today) {
    throw new Error(`Date cannot be in the future: ${dateStr}`)
  }

  return date
}

// ============================================================================
// User Confirmation
// ============================================================================

async function getUserConfirmation(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes')
    })
  })
}

// ============================================================================
// Main Script Logic
// ============================================================================

async function fixLinkedInMetrics() {
  const { date, startDate, endDate, orgId, dryRun, prod } = parseArgs()

  // Validate arguments
  if (!date && !startDate) {
    console.error('❌ Error: Must specify --date or --start')
    console.log('\nUsage:')
    console.log('  # Single day:')
    console.log('  npm run fix-linkedin-metrics -- --date=2026-01-22')
    console.log('\n  # Date range:')
    console.log('  npm run fix-linkedin-metrics -- --start=2026-01-22 --end=2026-01-27')
    console.log('\n  # Production database:')
    console.log('  npm run fix-linkedin-metrics -- --date=2026-01-22 --prod')
    console.log('\n  # Dry run (preview only):')
    console.log('  npm run fix-linkedin-metrics -- --date=2026-01-22 --dry-run')
    console.log('\n  # Specific organization (if multiple LinkedIn connections):')
    console.log('  npm run fix-linkedin-metrics -- --date=2026-01-22 --org-id=UUID')
    process.exit(1)
  }

  if (startDate && !endDate) {
    console.error('❌ Error: --start requires --end')
    process.exit(1)
  }

  // Determine date range
  let fetchStartDate: Date
  let fetchEndDate: Date

  if (date) {
    // Single day mode
    fetchStartDate = validateDate(date)
    fetchEndDate = new Date(fetchStartDate)
  } else {
    // Range mode
    fetchStartDate = validateDate(startDate!)
    fetchEndDate = validateDate(endDate!)

    if (fetchEndDate < fetchStartDate) {
      console.error('❌ Error: --end must be after --start')
      process.exit(1)
    }
  }

  // Validate environment variables
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseServiceKey) {
    console.error('❌ Error: Missing environment variables')
    console.error('   Required: SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // Determine Supabase URL based on environment
  const supabaseUrl = prod
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : 'http://127.0.0.1:54321'

  if (prod && !supabaseUrl) {
    console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL for production')
    process.exit(1)
  }

  // Create Supabase client
  const supabase = prod
    ? createClient(supabaseUrl!, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : createServiceClient()

  console.log(`🔍 Fetching LinkedIn connection...`)
  console.log(`   Target: ${prod ? 'Production' : 'Local dev'}\n`)

  // Fetch active LinkedIn connection
  let query = supabase
    .from('platform_connections')
    .select('id, organization_id, credentials, status')
    .eq('platform_type', 'linkedin')
    .eq('status', 'active')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data: connections, error: fetchError } = await query

  if (fetchError) {
    console.error('❌ Failed to fetch LinkedIn connection:', fetchError.message)
    process.exit(1)
  }

  if (!connections || connections.length === 0) {
    console.error('❌ No active LinkedIn connection found')
    if (orgId) {
      console.error(`   Searched for organization ID: ${orgId}`)
    }
    process.exit(1)
  }

  if (connections.length > 1 && !orgId) {
    console.error('❌ Multiple LinkedIn connections found. Please specify --org-id')
    console.log('\nAvailable connections:')
    for (const conn of connections) {
      console.log(
        `  - Org ID: ${conn.organization_id} (Connection ID: ${conn.id})`
      )
    }
    process.exit(1)
  }

  const connection = connections[0]
  console.log(
    `✅ Found connection for organization: ${connection.organization_id}`
  )
  console.log(`   Connection ID: ${connection.id}\n`)

  // Get credentials
  let credentials = connection.credentials as LinkedInCredentials

  // Check if token needs refresh
  const oauthProvider = getOAuthProvider(Platform.LINKEDIN)
  if (oauthProvider.shouldRefreshToken(credentials.expires_at)) {
    console.log('🔄 Refreshing expired access token...\n')

    const newTokens = await oauthProvider.refreshAccessToken(
      credentials.refresh_token
    )

    // Update database with new tokens using service client
    const expiresAt = oauthProvider.calculateExpiresAt(newTokens.expires_in)
    const updatedCredentials = {
      ...connection.credentials,
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: expiresAt,
    }

    await supabase
      .from('platform_connections')
      .update({ credentials: updatedCredentials })
      .eq('id', connection.id)

    // Update local credentials
    credentials = {
      ...credentials,
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: expiresAt,
    }

    console.log('✅ Token refreshed successfully\n')
  }

  // Initialize LinkedIn client
  const client = new LinkedInClient(credentials)

  // Calculate number of days
  const days =
    Math.ceil(
      (fetchEndDate.getTime() - fetchStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1

  console.log('📅 Date range:')
  console.log(`   From: ${fetchStartDate.toISOString().split('T')[0]}`)
  console.log(`   To:   ${fetchEndDate.toISOString().split('T')[0]}`)
  console.log(`   Days: ${days}`)
  console.log(`   Metrics per day: 6`)
  console.log(`   Total records: ${days * 6}\n`)

  console.log('🔄 Fetching data from LinkedIn...\n')

  try {
    // Fetch metrics for each day
    const dailyMetrics: Array<{
      date: string
      followers: number
      followerGrowth: number
      pageViews: number
      uniqueVisitors: number
      impressions: number
      reactions: number
    }> = []

    // Process each day individually
    let currentDate = new Date(fetchStartDate)
    while (currentDate <= fetchEndDate) {
      const dayStart = new Date(currentDate)
      dayStart.setHours(0, 0, 0, 0)

      const dayEnd = new Date(currentDate)
      dayEnd.setHours(23, 59, 59, 999)

      const metrics = await client.getAllMetrics(dayStart, dayEnd)

      dailyMetrics.push({
        date: currentDate.toISOString().split('T')[0],
        followers: metrics.followers,
        followerGrowth: metrics.followerGrowth,
        pageViews: metrics.pageViews,
        uniqueVisitors: metrics.uniqueVisitors,
        impressions: metrics.impressions,
        reactions: metrics.reactions,
      })

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (dailyMetrics.length === 0) {
      console.log('⚠️  No data returned from LinkedIn')
      console.log('   This may be because the date range has no activity')
      process.exit(0)
    }

    console.log(`✅ Fetched ${dailyMetrics.length} days of data\n`)

    // Convert to database records
    const records: Array<{
      organization_id: string
      campaign_id: null
      platform_type: 'linkedin'
      date: string
      metric_type: string
      value: number
    }> = []

    for (const day of dailyMetrics) {
      records.push(
        {
          organization_id: connection.organization_id,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_followers',
          value: day.followers,
        },
        {
          organization_id: connection.organization_id,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_follower_growth',
          value: day.followerGrowth,
        },
        {
          organization_id: connection.organization_id,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_page_views',
          value: day.pageViews,
        },
        {
          organization_id: connection.organization_id,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_unique_visitors',
          value: day.uniqueVisitors,
        },
        {
          organization_id: connection.organization_id,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_impressions',
          value: day.impressions,
        },
        {
          organization_id: connection.organization_id,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_reactions',
          value: day.reactions,
        }
      )
    }

    // Display preview
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('📊 PREVIEW OF DATA TO BE INSERTED')
    console.log('═══════════════════════════════════════════════════════════════\n')

    // Group by date for display
    const recordsByDate = new Map<string, typeof records>()
    for (const record of records) {
      if (!recordsByDate.has(record.date)) {
        recordsByDate.set(record.date, [])
      }
      recordsByDate.get(record.date)!.push(record)
    }

    // Display each day
    for (const [date, dayRecords] of Array.from(recordsByDate.entries()).sort()) {
      console.log(`📅 ${date}`)
      for (const record of dayRecords.sort((a, b) =>
        a.metric_type.localeCompare(b.metric_type)
      )) {
        const metricName = record.metric_type
          .replace('linkedin_', '')
          .replace(/_/g, ' ')
        console.log(
          `   ${metricName.padEnd(25)} ${record.value.toLocaleString()}`
        )
      }
      console.log('')
    }

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Total records: ${records.length}`)
    console.log('═══════════════════════════════════════════════════════════════\n')

    // Dry run mode
    if (dryRun) {
      console.log('🏁 Dry run complete (no data inserted)')
      process.exit(0)
    }

    // Require confirmation
    console.log('⚠️  This will UPSERT records into the database.')
    console.log('   Existing records for these dates will be UPDATED.\n')

    const confirmed = await getUserConfirmation('Type "yes" to proceed: ')

    if (!confirmed) {
      console.log('\n❌ Aborted by user')
      process.exit(0)
    }

    console.log('\n💾 Inserting records into database...\n')

    // Insert records (upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from('campaign_metrics')
      .upsert(records, {
        onConflict: 'organization_id,platform_type,date,metric_type',
      })

    if (insertError) {
      console.error('❌ Failed to insert records:', insertError.message)
      process.exit(1)
    }

    // Update last_sync_at timestamp
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    console.log('✅ Records inserted successfully!')
    console.log('\n🎉 Backfill complete!\n')
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run the script
fixLinkedInMetrics()
