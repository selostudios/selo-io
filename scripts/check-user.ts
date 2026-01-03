#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const email = 'owain@selostudios.com'

async function checkUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log(`🔍 Checking user: ${email}\n`)

  // Get auth user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  const authUser = users.find(u => u.email === email)

  if (!authUser) {
    console.log('❌ No auth user found')
    return
  }

  console.log('✅ Auth User:')
  console.log(`   ID: ${authUser.id}`)
  console.log(`   Email: ${authUser.email}`)
  console.log(`   Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`)

  // Get user record
  const { data: userRecord } = await supabase
    .from('users')
    .select('*, organization:organizations(id, name, industry)')
    .eq('id', authUser.id)
    .single()

  if (!userRecord) {
    console.log('\n❌ No user record in users table')
    return
  }

  console.log('\n✅ User Record:')
  console.log(`   User ID: ${userRecord.id}`)
  console.log(`   Organization ID: ${userRecord.organization_id}`)
  console.log(`   Role: ${userRecord.role}`)

  if (userRecord.organization) {
    const org = Array.isArray(userRecord.organization)
      ? userRecord.organization[0]
      : userRecord.organization

    console.log('\n✅ Organization:')
    console.log(`   ID: ${org?.id}`)
    console.log(`   Name: ${org?.name}`)
    console.log(`   Industry: ${org?.industry || 'N/A'}`)
  } else {
    console.log('\n❌ Organization not found')
  }
}

checkUser()
