#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Backfill metrics from a specific date
 * Usage:
 *   npm run backfill:metrics -- 2026-01-01        # Backfills from Jan 1 to yesterday
 *   npm run backfill:metrics -- 2026-01-01 --prod # Backfills production data
 *   npm run backfill:metrics -- --days=90 --prod  # Backfills last 90 days
 */

const fs = require('fs')
const path = require('path')

// Parse command line args
const args = process.argv.slice(2)
const dateArg = args.find((arg) => arg.match(/^\d{4}-\d{2}-\d{2}$/))
const daysArg = args.find((arg) => arg.startsWith('--days='))
const isProd = args.includes('--prod') || args.includes('-p')

// Calculate start date
let startDate
if (dateArg) {
  startDate = new Date(dateArg + 'T00:00:00Z')
} else if (daysArg) {
  const days = parseInt(daysArg.split('=')[1], 10)
  if (isNaN(days) || days <= 0) {
    console.error('❌ Error: Invalid --days value')
    process.exit(1)
  }
  startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)
} else {
  console.error('❌ Error: Date or --days required')
  console.error('\nUsage:')
  console.error('  npm run backfill:metrics -- 2026-01-01           # From specific date')
  console.error('  npm run backfill:metrics -- --days=90            # Last 90 days')
  console.error('  npm run backfill:metrics -- 2026-01-01 --prod    # Production')
  console.error('  npm run backfill:metrics -- --days=90 --prod     # Production, last 90 days')
  process.exit(1)
}

// Validate date
if (isNaN(startDate.getTime())) {
  console.error('❌ Error: Invalid date format')
  process.exit(1)
}

// End date is yesterday (we don't sync today since the day isn't complete)
const endDate = new Date()
endDate.setDate(endDate.getDate() - 1)
endDate.setHours(0, 0, 0, 0)

// Don't allow future start dates
if (startDate > endDate) {
  console.error('❌ Error: Start date cannot be after yesterday')
  process.exit(1)
}

// Load environment variables from .env.local or .env
function loadEnv() {
  const envPath = isProd
    ? path.join(__dirname, '..', '.env')
    : path.join(__dirname, '..', '.env.local')

  if (!fs.existsSync(envPath)) {
    console.error(`❌ Error: ${isProd ? '.env' : '.env.local'} file not found`)
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      env[key] = value
    }
  })

  return env
}

// Calculate number of days
function daysBetween(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.ceil((end - start) / msPerDay) + 1
}

async function backfillMetrics() {
  const env = loadEnv()

  if (!env.CRON_SECRET) {
    console.error('❌ Error: CRON_SECRET not found in environment file')
    process.exit(1)
  }

  const totalDays = daysBetween(startDate, endDate)
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  console.log(`\n🔄 Backfilling metrics...`)
  console.log(`   Target: ${isProd ? 'Production' : 'Local dev'}`)
  console.log(`   Date range: ${startDateStr} to ${endDateStr}`)
  console.log(`   Total days: ${totalDays}`)
  console.log(`\n⏳ This may take a while for large date ranges...\n`)

  try {
    const syncUrl = isProd
      ? 'https://selo-io.vercel.app/api/cron/daily-metrics-sync'
      : 'http://localhost:3000/api/cron/daily-metrics-sync'

    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: startDateStr,
        endDate: endDateStr,
      }),
    })

    const data = await syncResponse.json()

    if (!syncResponse.ok) {
      console.error(`❌ Backfill failed (HTTP ${syncResponse.status})`)
      console.error(`   Error: ${data.error || 'Unknown error'}`)
      process.exit(1)
    }

    console.log(`✅ Backfill completed successfully!\n`)
    console.log(`   Days processed: ${data.daysProcessed || totalDays}`)
    console.log(`   Synced: ${data.synced} operation${data.synced !== 1 ? 's' : ''}`)
    console.log(`   Failed: ${data.failed} operation${data.failed !== 1 ? 's' : ''}`)

    if (data.errors && data.errors.length > 0) {
      console.log(`\n⚠️  Errors:`)
      // Only show first 10 errors to avoid flooding console
      const errorsToShow = data.errors.slice(0, 10)
      errorsToShow.forEach((err, idx) => {
        console.log(
          `   ${idx + 1}. Connection ${err.connectionId.substring(0, 8)}... (${err.date || 'unknown date'})`
        )
        console.log(`      ${err.error}`)
      })
      if (data.errors.length > 10) {
        console.log(`   ... and ${data.errors.length - 10} more errors`)
      }
    }

    console.log()
  } catch (error) {
    console.error(`❌ Failed to backfill metrics`)
    console.error(`   ${error.message}`)

    if (!isProd && error.code === 'ECONNREFUSED') {
      console.error(`\n   💡 Make sure dev server is running:`)
      console.error(`      npm run dev`)
    }

    process.exit(1)
  }
}

backfillMetrics()
