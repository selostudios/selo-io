#!/usr/bin/env tsx
/**
 * LinkedIn Token Debugger
 *
 * This script helps diagnose why LinkedIn API calls are failing with 401 errors.
 * Run with: npx tsx scripts/debug-linkedin-token.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function debugLinkedInToken() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 LinkedIn Token Debugger\n')

  // 1. Check database connection
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('platform_type', 'linkedin')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !connection) {
    console.error('❌ No LinkedIn connection found in database')
    console.error(error)
    return
  }

  console.log('✅ Found LinkedIn connection')
  console.log(`   Created: ${connection.created_at}`)
  console.log(`   Status: ${connection.status}`)
  console.log(`   Organization ID: ${connection.organization_id}\n`)

  const credentials = connection.credentials as any

  // 2. Check token expiration
  console.log('📅 Token Expiration Check')
  if (!credentials.expires_at) {
    console.error('❌ expires_at is missing!')
  } else {
    const expiresAt = new Date(credentials.expires_at)
    const now = new Date()
    const daysUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    console.log(`   Expires at: ${expiresAt.toISOString()}`)
    console.log(`   Days until expiry: ${daysUntilExpiry}`)

    if (expiresAt < now) {
      console.log('   ❌ Token is EXPIRED')
    } else if (daysUntilExpiry < 7) {
      console.log('   ⚠️  Token expires soon (< 7 days)')
    } else {
      console.log('   ✅ Token is valid')
    }
  }
  console.log('')

  // 3. Check scopes
  console.log('🔐 OAuth Scopes Check')
  const scopes = credentials.scopes || []
  const requiredScopes = ['r_organization_social', 'r_organization_admin', 'rw_organization_admin']

  console.log(`   Granted scopes: ${scopes.join(', ')}`)

  const missingScopes = requiredScopes.filter(s => !scopes.includes(s))
  if (missingScopes.length > 0) {
    console.log(`   ❌ Missing scopes: ${missingScopes.join(', ')}`)
    console.log('   → Go to LinkedIn app settings and request these scopes')
  } else {
    console.log('   ✅ All required scopes granted')
  }
  console.log('')

  // 4. Test LinkedIn API call
  console.log('🌐 Testing LinkedIn API Call')
  if (!credentials.access_token) {
    console.error('❌ No access token found!')
    return
  }

  const orgId = credentials.organization_id
  if (!orgId) {
    console.error('❌ No organization_id found!')
    return
  }

  console.log(`   Access token: ${credentials.access_token.substring(0, 20)}...`)
  console.log(`   Organization ID: ${orgId}`)

  // Test a simple API call
  const testUrl = `https://api.linkedin.com/v2/organizations/${orgId}`
  console.log(`   Testing: GET ${testUrl}`)

  try {
    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      }
    })

    console.log(`   Response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const text = await response.text()
      console.log(`   Response body: ${text}`)

      if (response.status === 401) {
        console.log('\n❌ 401 Unauthorized - Possible causes:')
        console.log('   1. LinkedIn app not verified (check Products tab in LinkedIn app)')
        console.log('   2. Token was revoked')
        console.log('   3. Organization ID is incorrect')
        console.log('   4. Your LinkedIn account lacks admin access to this organization')
      } else if (response.status === 403) {
        console.log('\n❌ 403 Forbidden - Possible causes:')
        console.log('   1. Missing required scope for this API endpoint')
        console.log('   2. LinkedIn app needs "Marketing Developer Platform" product enabled')
      }
    } else {
      const data = await response.json()
      console.log('   ✅ API call successful!')
      console.log(`   Organization name: ${data.localizedName || 'N/A'}`)
    }
  } catch (err) {
    console.error('   ❌ Network error:', err)
  }

  console.log('\n' + '='.repeat(60))
  console.log('💡 Next Steps:')
  console.log('='.repeat(60))
  console.log('1. Check your LinkedIn app dashboard:')
  console.log('   https://www.linkedin.com/developers/apps')
  console.log('')
  console.log('2. Verify these products are APPROVED (not pending):')
  console.log('   - Marketing Developer Platform')
  console.log('   - Advertising API (if using ad metrics)')
  console.log('')
  console.log('3. Verify your LinkedIn account has admin access to organization:')
  console.log('   https://www.linkedin.com/company/' + orgId)
  console.log('')
  console.log('4. Check that all scopes are granted in the Products tab')
  console.log('='.repeat(60))
}

debugLinkedInToken().catch(console.error)
