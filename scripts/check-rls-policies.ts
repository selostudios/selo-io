#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function checkPolicies() {
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

  console.log('🔍 Checking RLS policies on organizations table...\n')

  // Query pg_policies to see what policies exist
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'organizations'
      ORDER BY policyname;
    `,
  })

  if (error) {
    // Try direct query if RPC doesn't exist
    const { data: policies, error: queryError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'organizations')

    if (queryError) {
      console.error('❌ Could not query policies:', queryError)
      console.log('\nTrying alternative method...\n')

      // Just check if we can insert an org as a test user
      const testUserId = '69718cdd-62ec-423f-899a-8de38c7ee7c8'
      console.log(`Testing with user ID: ${testUserId}`)

      // Check current user record
      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', testUserId)
        .single()

      console.log('User record:', userRecord)
      return
    }

    console.log('Policies:', policies)
    return
  }

  console.log('Policies found:', data)
}

checkPolicies()
