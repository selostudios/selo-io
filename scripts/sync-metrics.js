#!/usr/bin/env node

/**
 * Manually trigger metrics sync
 * Usage:
 *   npm run sync:metrics              # Syncs local dev server
 *   npm run sync:metrics -- --prod    # Syncs production
 */

const fs = require('fs')
const path = require('path')

// Parse command line args
const args = process.argv.slice(2)
const isProd = args.includes('--prod') || args.includes('-p')

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

async function syncMetrics() {
  const env = loadEnv()

  if (!env.CRON_SECRET) {
    console.error('❌ Error: CRON_SECRET not found in .env.local')
    process.exit(1)
  }

  const url = isProd
    ? 'https://selo-io.vercel.app/api/cron/daily-metrics-sync'
    : 'http://localhost:3000/api/cron/daily-metrics-sync'

  console.log(`\n🔄 Triggering metrics sync...`)
  console.log(`   Target: ${isProd ? 'Production' : 'Local dev'}`)
  console.log(`   URL: ${url}\n`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`❌ Sync failed (HTTP ${response.status})`)
      console.error(`   Error: ${data.error || 'Unknown error'}`)
      process.exit(1)
    }

    console.log(`✅ Sync completed successfully!\n`)
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
    console.error(`❌ Failed to connect to server`)
    console.error(`   ${error.message}`)

    if (!isProd && error.code === 'ECONNREFUSED') {
      console.error(`\n   💡 Make sure dev server is running: npm run dev`)
    }

    process.exit(1)
  }
}

syncMetrics()
