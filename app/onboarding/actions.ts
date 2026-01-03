'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createOrganization(formData: FormData): Promise<{ error: string } | never> {
  const name = formData.get('name') as string
  const industry = formData.get('industry') as string

  // Input validation
  if (!name || name.trim().length === 0) {
    return { error: 'Organization name is required' }
  }
  if (name.length > 100) {
    return { error: 'Organization name must be less than 100 characters' }
  }
  if (industry && industry.length > 100) {
    return { error: 'Industry must be less than 100 characters' }
  }

  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[Onboarding Error]', { type: 'auth_check', timestamp: new Date().toISOString() })
    return { error: 'Not authenticated' }
  }

  // Check if user already has an organization (prevent race conditions)
  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  console.error('[Onboarding Debug]', {
    type: 'existing_user_check',
    userId: user.id,
    existingUser,
    existingUserError,
    timestamp: new Date().toISOString()
  })

  // If the query failed (not just no results), it might be an RLS issue
  if (existingUserError && existingUserError.code !== 'PGRST116') {
    console.error('[Onboarding Error]', {
      type: 'user_query_failed',
      error: existingUserError,
      timestamp: new Date().toISOString()
    })
    return {
      error: `Could not check existing user: ${existingUserError.message} (${existingUserError.code})`
    }
  }

  if (existingUser?.organization_id) {
    console.error('[Onboarding Error]', { type: 'already_has_org', orgId: existingUser.organization_id })
    return { error: 'You already have an organization' }
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: name.trim(),
      industry: industry?.trim() || null,
    })
    .select()
    .single()

  if (orgError) {
    console.error('[Onboarding Error]', {
      type: 'org_creation',
      error: orgError,
      code: orgError.code,
      message: orgError.message,
      details: orgError.details,
      hint: orgError.hint,
      timestamp: new Date().toISOString()
    })

    // Show detailed error for debugging (TODO: make generic in production later)
    return {
      error: `Organization creation failed: ${orgError.message}${orgError.code ? ` (code: ${orgError.code})` : ''}${orgError.hint ? ` - ${orgError.hint}` : ''}`
    }
  }

  // Create user record linking to organization
  const { error: userRecordError } = await supabase
    .from('users')
    .insert({
      id: user.id,
      organization_id: org.id,
      role: 'admin',
    })

  if (userRecordError) {
    // Cleanup: Delete the organization we just created since user record failed
    await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id)

    console.error('[Onboarding Error]', {
      type: 'user_record_creation',
      error: userRecordError,
      timestamp: new Date().toISOString()
    })

    // Show detailed error for debugging
    return {
      error: `User record creation failed: ${userRecordError.message}${userRecordError.code ? ` (code: ${userRecordError.code})` : ''}`
    }
  }

  redirect('/dashboard')
}
