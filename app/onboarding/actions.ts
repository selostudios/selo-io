'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createOrganization(formData: FormData) {
  const name = formData.get('name') as string
  const industry = formData.get('industry') as string

  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      industry,
    })
    .select()
    .single()

  if (orgError) {
    return { error: orgError.message }
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
    return { error: userRecordError.message }
  }

  redirect('/dashboard')
}
