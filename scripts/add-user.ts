#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const params: { email?: string; password?: string; orgName?: string; industry?: string } = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--email=')) {
      params.email = arg.split('=')[1]
    } else if (arg.startsWith('--password=') || arg.startsWith('--pass=')) {
      params.password = arg.split('=')[1]
    } else if (arg.startsWith('--org=')) {
      params.orgName = arg.split('=')[1]
    } else if (arg.startsWith('--industry=')) {
      params.industry = arg.split('=')[1]
    }
  }

  return params
}

async function addUser() {
  const params = parseArgs()

  // Default to test credentials if not provided
  if (!params.email) params.email = 'test@test.com'
  if (!params.password) params.password = 'password1234'

  const { email, password, orgName, industry } = params as Required<
    Pick<typeof params, 'email' | 'password'>
  > &
    typeof params

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing environment variables')
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('🚀 Creating user account...\n')

  try {
    // Step 1: Create auth user
    console.log(`📧 Email: ${email}`)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      console.error('❌ Failed to create auth user:', authError.message)
      process.exit(1)
    }

    console.log(`✅ Auth user created (ID: ${authData.user.id})`)

    // Step 2: Create organization
    const organizationName = orgName || `${email.split('@')[0]}'s Organization`
    console.log(`\n🏢 Creating organization: ${organizationName}`)

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organizationName,
        industry: industry || null,
      })
      .select()
      .single()

    if (orgError) {
      console.error('❌ Failed to create organization:', orgError.message)
      // Cleanup: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.log('🧹 Cleaned up auth user')
      process.exit(1)
    }

    console.log(`✅ Organization created (ID: ${orgData.id})`)

    // Step 3: Link user to organization
    console.log(`\n🔗 Linking user to organization...`)

    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      organization_id: orgData.id,
      role: 'admin',
    })

    if (userError) {
      console.error('❌ Failed to link user to organization:', userError.message)
      // Cleanup: delete org and auth user
      await supabase.from('organizations').delete().eq('id', orgData.id)
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.log('🧹 Cleaned up organization and auth user')
      process.exit(1)
    }

    // Create team membership (primary source of truth for org + role)
    const { error: memberError } = await supabase.from('team_members').insert({
      user_id: authData.user.id,
      organization_id: orgData.id,
      role: 'admin',
    })

    if (memberError) {
      console.error('⚠️  Warning: Failed to create team_members record:', memberError.message)
    }

    console.log(`✅ User linked to organization with admin role`)

    // Success summary
    console.log('\n✨ User created successfully!\n')
    console.log('═══════════════════════════════════════')
    console.log(`📧 Email:        ${email}`)
    console.log(`🔑 User ID:      ${authData.user.id}`)
    console.log(`🏢 Organization: ${organizationName}`)
    console.log(`🆔 Org ID:       ${orgData.id}`)
    console.log(`👤 Role:         admin`)
    console.log('═══════════════════════════════════════')
    console.log('\n🎉 User can now sign in at your application!')
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the script
addUser()
