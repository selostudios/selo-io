#!/usr/bin/env tsx
/**
 * Simple LinkedIn Token Debugger
 *
 * This version doesn't require database access - just tests the API directly
 * Run with: npx tsx scripts/debug-linkedin-simple.ts <access_token> <org_id>
 *
 * Get these values from Supabase dashboard:
 * SELECT credentials->>'access_token', credentials->>'organization_id'
 * FROM platform_connections
 * WHERE platform_type = 'linkedin'
 * ORDER BY created_at DESC
 * LIMIT 1;
 */

const accessToken = process.argv[2]
const orgId = process.argv[3]

if (!accessToken || !orgId) {
  console.error('Usage: npx tsx scripts/debug-linkedin-simple.ts <access_token> <org_id>')
  console.error('')
  console.error('Get these from Supabase dashboard SQL editor:')
  console.error('')
  console.error('  SELECT ')
  console.error('    credentials->>\'access_token\' as token,')
  console.error('    credentials->>\'organization_id\' as org_id,')
  console.error('    credentials->>\'expires_at\' as expires,')
  console.error('    credentials->\'scopes\' as scopes')
  console.error('  FROM platform_connections')
  console.error('  WHERE platform_type = \'linkedin\'')
  console.error('  ORDER BY created_at DESC')
  console.error('  LIMIT 1;')
  console.error('')
  process.exit(1)
}

async function testLinkedInAPI() {
  console.log('🔍 LinkedIn API Debugger\n')
  console.log('Testing with:')
  console.log(`  Token: ${accessToken.substring(0, 20)}...`)
  console.log(`  Org ID: ${orgId}\n`)

  // Test 1: Basic organization info
  console.log('📋 Test 1: Fetch organization info')
  const orgUrl = `https://api.linkedin.com/v2/organizations/${orgId}`
  console.log(`  GET ${orgUrl}`)

  try {
    const response = await fetch(orgUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      }
    })

    console.log(`  Status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log('  ✅ SUCCESS')
      console.log(`  Organization: ${data.localizedName || 'N/A'}`)
    } else {
      const text = await response.text()
      console.log('  ❌ FAILED')
      console.log(`  Response: ${text.substring(0, 200)}`)

      if (response.status === 401) {
        console.log('\n💡 401 Unauthorized - Possible causes:')
        console.log('  1. Token has expired')
        console.log('  2. LinkedIn app not verified/approved')
        console.log('  3. Token was revoked')
        console.log('  4. Organization ID is incorrect')
        console.log('\n🔧 Next steps:')
        console.log('  1. Check LinkedIn app at: https://www.linkedin.com/developers/apps')
        console.log('  2. Verify "Marketing Developer Platform" product is APPROVED')
        console.log('  3. Try disconnecting and reconnecting LinkedIn')
      } else if (response.status === 403) {
        console.log('\n💡 403 Forbidden - Possible causes:')
        console.log('  1. Missing required OAuth scope')
        console.log('  2. LinkedIn app needs product approval')
        console.log('  3. Your account lacks admin access to this organization')
      }
      return
    }
  } catch (error) {
    console.log('  ❌ NETWORK ERROR')
    console.error(error)
    return
  }

  console.log('')

  // Test 2: Follower statistics (requires scope)
  console.log('📊 Test 2: Fetch follower statistics')
  const now = Date.now()
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000)
  const orgUrn = `urn:li:organization:${orgId}`
  const timeRange = `(start:${weekAgo},end:${now})`
  const followerUrl = `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`

  console.log(`  GET ${followerUrl.substring(0, 80)}...`)

  try {
    const response = await fetch(`https://api.linkedin.com/v2${followerUrl}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      }
    })

    console.log(`  Status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log('  ✅ SUCCESS')
      console.log(`  Data points: ${data.elements?.length || 0}`)
    } else {
      const text = await response.text()
      console.log('  ❌ FAILED')
      console.log(`  Response: ${text.substring(0, 200)}`)

      if (response.status === 403) {
        console.log('\n💡 Missing scope or product approval')
        console.log('  Required scopes:')
        console.log('    - r_organization_social')
        console.log('    - r_organization_admin')
        console.log('    - rw_organization_admin')
      }
    }
  } catch (error) {
    console.log('  ❌ NETWORK ERROR')
    console.error(error)
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎯 Summary')
  console.log('='.repeat(60))
  console.log('If tests failed, check:')
  console.log('  1. LinkedIn app verification status')
  console.log('  2. OAuth scopes granted during connection')
  console.log('  3. Your LinkedIn account has admin access')
  console.log('  4. Token hasn\'t expired (check expires_at in database)')
  console.log('='.repeat(60))
}

testLinkedInAPI().catch(console.error)
