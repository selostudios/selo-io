'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function connectPlatform(formData: FormData) {
  const platform_type = formData.get('platform_type') as string
  const credentials = formData.get('credentials') as string

  // Validate platform type
  const validPlatforms: Array<'hubspot' | 'google_analytics' | 'linkedin' | 'meta' | 'instagram'> =
    ['hubspot', 'google_analytics', 'linkedin', 'meta', 'instagram']
  if (
    !platform_type ||
    !validPlatforms.includes(platform_type as (typeof validPlatforms)[number])
  ) {
    return { error: 'Invalid platform type' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  // Validate credentials structure based on platform type
  const requiredFields = {
    hubspot: ['api_key'],
    google_analytics: ['property_id', 'credentials'],
    linkedin: ['access_token', 'organization_id'],
    meta: ['access_token', 'page_id'],
    instagram: ['access_token', 'account_id'],
  }

  const required = requiredFields[platform_type as keyof typeof requiredFields]
  if (!required || !required.every((field) => field in credentialsObj)) {
    return { error: 'Missing required credentials for this platform' }
  }

  // TODO: Encrypt credentials before storing
  // For MVP, storing as-is (SECURITY: Must encrypt in production!)

  const { error } = await supabase.from('platform_connections').upsert(
    {
      organization_id: userRecord.organization_id,
      platform_type,
      credentials: credentialsObj,
      status: 'active',
    },
    {
      onConflict: 'organization_id,platform_type',
    }
  )

  if (error) {
    console.error('[Connect Platform Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to connect platform. Please try again.' }
  }

  revalidatePath('/settings/integrations')
  return { success: true }
}

export async function disconnectPlatform(connectionId: string) {
  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Authorization check - verify admin role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    console.error('[Disconnect Platform Error]', {
      type: 'unauthorized',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Only admins can disconnect platforms' }
  }

  // Delete with organization check for defense in depth
  const { error } = await supabase
    .from('platform_connections')
    .delete()
    .eq('id', connectionId)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    console.error('[Disconnect Platform Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to disconnect platform. Please try again.' }
  }

  revalidatePath('/settings/integrations')
  return { success: true }
}
