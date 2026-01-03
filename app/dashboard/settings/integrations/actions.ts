'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function connectPlatform(formData: FormData) {
  const platform_type = formData.get('platform_type') as string
  const credentials = formData.get('credentials') as string

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can connect platforms' }
  }

  // Parse credentials
  let credentialsObj
  try {
    credentialsObj = JSON.parse(credentials)
  } catch {
    return { error: 'Invalid credentials format' }
  }

  // TODO: Encrypt credentials before storing
  // For MVP, storing as-is (SECURITY: Must encrypt in production!)

  const { error } = await supabase
    .from('platform_connections')
    .upsert({
      organization_id: userRecord.organization_id,
      platform_type,
      credentials: credentialsObj,
      status: 'active',
    }, {
      onConflict: 'organization_id,platform_type'
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/integrations')
  return { success: true }
}

export async function disconnectPlatform(connectionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('platform_connections')
    .delete()
    .eq('id', connectionId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/integrations')
  return { success: true }
}
