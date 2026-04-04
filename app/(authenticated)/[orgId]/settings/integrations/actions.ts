'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { encryptCredentials, decryptCredentials } from '@/lib/utils/crypto'
import { withIntegrationsAuth } from '@/lib/actions/with-auth'
import { PlatformType } from '@/lib/enums'
import type { Account } from '@/lib/oauth/types'

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
    // No organization_id filter needed — connectionId is unique and RLS enforces org isolation
    const { error } = await ctx.supabase
      .from('platform_connections')
      .delete()
      .eq('id', connectionId)

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

interface PendingOAuthData {
  platform: string
  tokens: {
    access_token: string
    refresh_token: string
    expires_at: string
    scopes: string[]
  }
  accounts: Account[]
}

export async function completeOAuthConnection(accountId: string, orgId: string) {
  const cookieStore = await cookies()
  const pendingCookie = cookieStore.get('oauth_pending_tokens')?.value

  if (!pendingCookie) {
    return { error: 'OAuth session expired. Please try connecting again.' }
  }

  let pending: PendingOAuthData
  try {
    pending = decryptCredentials<PendingOAuthData>(pendingCookie)
  } catch {
    cookieStore.delete('oauth_pending_tokens')
    cookieStore.delete('oauth_org_id')
    return { error: 'Invalid OAuth session. Please try connecting again.' }
  }

  const selectedAccount = pending.accounts.find((a) => a.id === accountId)
  if (!selectedAccount) {
    return { error: 'Invalid account selection.' }
  }

  return withIntegrationsAuth(async (ctx) => {
    // Use the orgId from the URL (the org the user is viewing), not the
    // default from team_members which is arbitrary for multi-org users.
    const targetOrgId = orgId || ctx.organizationId

    // Verify user has access to this org
    if (targetOrgId !== ctx.organizationId && !ctx.isInternal) {
      const { data: membership } = await ctx.supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', ctx.userId)
        .eq('organization_id', targetOrgId)
        .single()

      if (!membership) {
        return { error: 'You do not have access to this organization.' }
      }
    }

    // Check if this specific account is already connected
    const { data: existing } = await ctx.supabase
      .from('platform_connections')
      .select('id')
      .eq('organization_id', targetOrgId)
      .eq('platform_type', pending.platform)
      .eq('account_name', selectedAccount.name)
      .single()

    if (existing) {
      cookieStore.delete('oauth_pending_tokens')
      cookieStore.delete('oauth_org_id')
      return { error: `${selectedAccount.name} is already connected.` }
    }

    const { error } = await ctx.supabase.from('platform_connections').insert({
      organization_id: targetOrgId,
      platform_type: pending.platform,
      account_name: selectedAccount.name,
      credentials: {
        access_token: pending.tokens.access_token,
        refresh_token: pending.tokens.refresh_token,
        expires_at: pending.tokens.expires_at,
        organization_id: selectedAccount.id,
        organization_name: selectedAccount.name,
        scopes: pending.tokens.scopes,
      },
      status: 'active',
    })

    if (error) {
      console.error('[Complete OAuth Connection Error]', {
        type: 'database_error',
        timestamp: new Date().toISOString(),
      })
      return { error: 'Failed to save connection. Please try again.' }
    }

    // Clean up cookies
    cookieStore.delete('oauth_pending_tokens')
    cookieStore.delete('oauth_org_id')

    revalidatePath('/settings/integrations')
    return { success: true, platform: pending.platform }
  })
}

export async function cancelOAuthConnection() {
  const cookieStore = await cookies()
  cookieStore.delete('oauth_pending_tokens')
  cookieStore.delete('oauth_org_id')
}

export async function updateConnectionDisplayName(connectionId: string, displayName: string) {
  return withIntegrationsAuth(async (ctx) => {
    // No organization_id filter needed — connectionId is unique and RLS enforces org isolation
    const { error } = await ctx.supabase
      .from('platform_connections')
      .update({ display_name: displayName.trim() || null })
      .eq('id', connectionId)

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
