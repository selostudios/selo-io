#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const params: { email?: string; password?: string } = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--email=')) {
      params.email = arg.split('=')[1]
    } else if (arg.startsWith('--password=') || arg.startsWith('--pass=')) {
      params.password = arg.split('=')[1]
    }
  }

  return params
}

async function resetPassword() {
  const { email, password } = parseArgs()

  // Validate required parameters
  if (!email || !password) {
    console.error('❌ Error: --email and --password are required')
    console.log('\nUsage:')
    console.log('  npm run reset-password -- --email=user@example.com --password=newpass123')
    process.exit(1)
  }

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

  console.log('🔐 Resetting password...\n')

  try {
    // Get user by email
    console.log(`📧 Looking up user: ${email}`)
    const {
      data: { users },
      error: listError,
    } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Failed to list users:', listError.message)
      process.exit(1)
    }

    const user = users.find((u) => u.email === email)

    if (!user) {
      console.error(`❌ User not found: ${email}`)
      process.exit(1)
    }

    console.log(`✅ User found (ID: ${user.id})`)

    // Update password
    console.log(`\n🔑 Updating password...`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password })

    if (updateError) {
      console.error('❌ Failed to update password:', updateError.message)
      process.exit(1)
    }

    console.log(`✅ Password updated successfully`)

    // Success summary
    console.log('\n✨ Password reset complete!\n')
    console.log('═══════════════════════════════════════')
    console.log(`📧 Email:   ${email}`)
    console.log(`🔑 User ID: ${user.id}`)
    console.log('═══════════════════════════════════════')
    console.log('\n🎉 User can now sign in with the new password!')
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the script
resetPassword()
