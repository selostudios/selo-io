#!/usr/bin/env node
/**
 * Fails the build if any required environment variable is missing.
 * Runs as a `prebuild` hook so broken configs never reach production.
 *
 * NEXT_PUBLIC_* vars are baked into the client bundle at build time, so
 * missing them here is catastrophic — the deployed app will throw
 * "Your project's URL and Key are required" on every request.
 */

import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'

// Local builds rely on .env.local (Next.js loads it, but the prebuild hook
// runs before Next). Vercel injects env vars directly, so no-op there.
if (!process.env.VERCEL) {
  for (const file of ['.env.local', '.env.development.local', '.env']) {
    if (existsSync(file)) loadDotenv({ path: file, override: false, quiet: true })
  }
}

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRON_SECRET',
]

const RECOMMENDED = ['ALERT_EMAIL', 'NEXT_PUBLIC_SITE_URL']

const missing = REQUIRED.filter((key) => {
  const v = process.env[key]
  return !v || v.trim().length === 0
})

const missingRecommended = RECOMMENDED.filter((key) => {
  const v = process.env[key]
  return !v || v.trim().length === 0
})

if (missingRecommended.length > 0) {
  console.warn(
    `[check-env] Warning: recommended env vars not set: ${missingRecommended.join(', ')}`
  )
}

if (missing.length > 0) {
  console.error('')
  console.error('[check-env] Build aborted — required env vars are missing:')
  for (const key of missing) {
    console.error(`  - ${key}`)
  }
  console.error('')
  console.error('Set these in Vercel → Project Settings → Environment Variables')
  console.error('(or in .env.local for local builds) and redeploy.')
  console.error('')
  process.exit(1)
}

console.log(`[check-env] All ${REQUIRED.length} required env vars present.`)
