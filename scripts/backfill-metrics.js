#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Backfill metrics from a specific date
 * Usage:
 *   npm run backfill:metrics -- 2026-01-24        # Backfills from Jan 24 to now
 *   npm run backfill:metrics -- 2026-01-24 --prod # Backfills production data
 */

const fs = require('fs')
const path = require('path')

// Parse command line args
const args = process.argv.slice(2)
const dateArg = args.find(arg => arg.match(/^\d{4}-\d{2}-\d{2}$/))
const isProd = args.includes('--prod') || args.includes('-p')

if (!dateArg) {
  console.error('❌ Error: Date required in YYYY-MM-DD format')
  console.error('\nUsage:')
  console.error('  npm run backfill:metrics -- 2026-01-24')
  console.error('  npm run backfill:metrics -- 2026-01-24 --prod')
  process.exit(1)
}

// Validate date
const backfillDate = new Date(dateArg + 'T00:00:00Z')
if (isNaN(backfillDate.getTime())) {
  console.error('❌ Error: Invalid date format')
  process.exit(1)
}

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.local file not found')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      env[key] = value
    }
  })

  return env
}

async function backfillMetrics() {
  const env = loadEnv()

  if (!env.CRON_SECRET) {
    console.error('❌ Error: CRON_SECRET not found in .env.local')
    process.exit(1)
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
    process.exit(1)
  }

  const supabaseUrl = isProd
    ? env.NEXT_PUBLIC_SUPABASE_URL
    : 'http://127.0.0.1:54321'

  console.log(`\n🔄 Backfilling metrics from ${dateArg}...`)
  console.log(`   Target: ${isProd ? 'Production' : 'Local dev'}`)
  console.log(`   Date range: ${dateArg} to now\n`)

  try {
    // Step 1: Update last_sync_at to backfill date for all active connections
    console.log('📝 Resetting last_sync_at timestamps...')

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/platform_connections?status=eq.active`, {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ last_sync_at: backfillDate.toISOString() })
    })

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      console.error(`❌ Failed to update timestamps: ${error}`)
      process.exit(1)
    }

    const updatedConnections = await updateResponse.json()
    console.log(`   ✓ Updated ${updatedConnections.length} connection(s)\n`)

    // Step 2: Trigger sync
    console.log('🔄 Syncing metrics...')

    const syncUrl = isProd
      ? 'https://selo-io.vercel.app/api/cron/daily-metrics-sync'
      : 'http://localhost:3000/api/cron/daily-metrics-sync'

    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await syncResponse.json()

    if (!syncResponse.ok) {
      console.error(`❌ Sync failed (HTTP ${syncResponse.status})`)
      console.error(`   Error: ${data.error || 'Unknown error'}`)
      process.exit(1)
    }

    console.log(`✅ Backfill completed successfully!\n`)
    console.log(`   Synced: ${data.synced} connection${data.synced !== 1 ? 's' : ''}`)
    console.log(`   Failed: ${data.failed} connection${data.failed !== 1 ? 's' : ''}`)

    if (data.errors && data.errors.length > 0) {
      console.log(`\n⚠️  Errors:`)
      data.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. Connection ${err.connectionId.substring(0, 8)}...`)
        console.log(`      ${err.error}`)
      })
    }

    console.log()
  } catch (error) {
    console.error(`❌ Failed to backfill metrics`)
    console.error(`   ${error.message}`)

    if (!isProd && error.code === 'ECONNREFUSED') {
      console.error(`\n   💡 Make sure dev server and Supabase are running:`)
      console.error(`      npm run dev`)
      console.error(`      supabase start`)
    }

    process.exit(1)
  }
}

backfillMetrics()
