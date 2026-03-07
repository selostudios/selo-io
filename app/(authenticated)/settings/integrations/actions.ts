'use server'

import { revalidatePath } from 'next/cache'
import { encryptCredentials } from '@/lib/utils/crypto'
import { withIntegrationsAuth } from '@/lib/actions/with-auth'
import { PlatformType } from '@/lib/enums'

export async function connectPlatform(formData: FormData) {
  const platform_type = formData.get('platform_type') as string
  const credentials = formData.get('credentials') as string

  // Validate platform type
  const validPlatforms: Array<PlatformType> = [
    PlatformType.HubSpot,
    PlatformType.GoogleAnalytics,
    PlatformType.LinkedIn,
    PlatformType.Meta,
    PlatformType.Instagram,
  ]

  if (!platform_type || !validPlatforms.includes(platform_type as PlatformType)) {
    return { error: 'Invalid platform type' }
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

  return withIntegrationsAuth(async (ctx) => {
    // Encrypt credentials before storing
    const encryptedCredentials = encryptCredentials(credentialsObj)

    const { error } = await ctx.supabase.from('platform_connections').upsert(
      {
        organization_id: ctx.organizationId,
        platform_type,
        credentials: { encrypted: encryptedCredentials },
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
  })
}

export async function disconnectPlatform(connectionId: string) {
  return withIntegrationsAuth(async (ctx) => {
    // Delete with organization check for defense in depth
    const { error } = await ctx.supabase
      .from('platform_connections')
      .delete()
      .eq('id', connectionId)
      .eq('organization_id', ctx.organizationId!)

    if (error) {
      console.error('[Disconnect Platform Error]', {
        type: 'database_error',
        timestamp: new Date().toISOString(),
      })
      return { error: 'Failed to disconnect platform. Please try again.' }
    }

    revalidatePath('/settings/integrations')
    return { success: true }
  })
}

export async function updateConnectionDisplayName(connectionId: string, displayName: string) {
  return withIntegrationsAuth(async (ctx) => {
    const { error } = await ctx.supabase
      .from('platform_connections')
      .update({ display_name: displayName.trim() || null })
      .eq('id', connectionId)
      .eq('organization_id', ctx.organizationId!)

    if (error) {
      console.error('[Update Display Name Error]', {
        type: 'database_error',
        timestamp: new Date().toISOString(),
      })
      return { error: 'Failed to update display name' }
    }

    revalidatePath('/settings/integrations')
    return { success: true }
  })
}
