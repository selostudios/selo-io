'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { encryptCredentials, decryptCredentials } from '@/lib/utils/crypto'
import { maskCredential, ENV_VAR_MAP } from '@/lib/app-settings/credentials'
import { requireInternalUser } from '@/lib/app-settings/auth'

interface AppSettingDisplay {
  key: string
  configured: boolean
  maskedValue: string | null
  updatedAt: string | null
  updatedByEmail: string | null
}

const CREDENTIAL_FIELD: Record<string, string> = {
  anthropic: 'api_key',
  openai: 'api_key',
  perplexity: 'api_key',
  resend: 'api_key',
  pagespeed: 'api_key',
  cron_secret: 'secret',
  email_config: '__plaintext__',
}

export async function getAppSettings(): Promise<AppSettingDisplay[] | { error: string }> {
  const { error, supabase } = await requireInternalUser()
  if (error) return { error }

  const { data: settings, error: fetchError } = await supabase!
    .from('app_settings')
    .select('key, credentials, updated_at, updated_by')
    .order('key')

  if (fetchError) {
    console.error('[App Settings Error]', {
      type: 'fetch_settings',
      timestamp: new Date().toISOString(),
      error: fetchError.message,
    })
    return { error: 'Failed to load settings' }
  }

  // Fetch updater emails
  const updaterIds = [
    ...new Set((settings ?? []).filter((s) => s.updated_by).map((s) => s.updated_by)),
  ]
  const emailMap: Record<string, string> = {}
  if (updaterIds.length > 0) {
    const serviceClient = createServiceClient()
    const emailResults = await Promise.all(
      updaterIds.map((uid) => serviceClient.auth.admin.getUserById(uid!))
    )
    for (const { data: authUser } of emailResults) {
      if (authUser?.user?.email && authUser.user.id) {
        emailMap[authUser.user.id] = authUser.user.email
      }
    }
  }

  const allKeys = [
    'anthropic',
    'openai',
    'perplexity',
    'resend',
    'pagespeed',
    'cron_secret',
    'email_config',
  ]
  const settingsMap = new Map((settings ?? []).map((s) => [s.key, s]))

  return allKeys.map((key) => {
    const setting = settingsMap.get(key)

    // Check env var fallback for configured status
    const envVar = ENV_VAR_MAP[key]
    const hasEnvVar = envVar ? !!process.env[envVar] : false

    if (!setting) {
      if (hasEnvVar) {
        return {
          key,
          configured: true,
          maskedValue: '(set via environment variable)',
          updatedAt: null,
          updatedByEmail: null,
        }
      }
      return { key, configured: false, maskedValue: null, updatedAt: null, updatedByEmail: null }
    }

    let maskedValue: string | null = null
    try {
      if (key === 'email_config') {
        const config = setting.credentials as { from_name?: string; from_email?: string }
        maskedValue = config.from_email ?? null
      } else {
        const decrypted = decryptCredentials<Record<string, string>>(setting.credentials as string)
        const field = CREDENTIAL_FIELD[key] ?? 'api_key'
        maskedValue = maskCredential(decrypted[field] ?? '')
      }
    } catch {
      maskedValue = '(decrypt error)'
    }

    return {
      key,
      configured: true,
      maskedValue,
      updatedAt: setting.updated_at,
      updatedByEmail: setting.updated_by ? (emailMap[setting.updated_by] ?? null) : null,
    }
  })
}

export async function updateAppSetting(key: string, value: string) {
  const { error, user, userRecord } = await requireInternalUser()
  if (error) return { error }
  if (userRecord!.role !== 'admin' && !userRecord!.is_internal)
    return { error: 'Admin access required' }

  const field = CREDENTIAL_FIELD[key]
  if (!field) return { error: 'Unknown setting key' }

  let credentials: unknown
  if (key === 'email_config') {
    try {
      credentials = JSON.parse(value)
    } catch {
      return { error: 'Invalid JSON for email config' }
    }
  } else {
    credentials = encryptCredentials({ [field]: value })
  }

  // Use service client to bypass RLS — auth is already verified above
  const serviceClient = createServiceClient()
  const { error: upsertError } = await serviceClient.from('app_settings').upsert(
    {
      key,
      credentials,
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (upsertError) {
    console.error('[App Settings Error]', {
      type: 'update_setting',
      key,
      timestamp: new Date().toISOString(),
      error: upsertError.message,
    })
    return { error: `Failed to update setting: ${upsertError.message}` }
  }

  revalidatePath('/app-settings/integrations')
  return { success: true }
}

export async function removeAppSetting(key: string) {
  const { error, userRecord } = await requireInternalUser()
  if (error) return { error }
  if (userRecord!.role !== 'admin' && !userRecord!.is_internal)
    return { error: 'Admin access required' }

  // Use service client to bypass RLS — auth is already verified above
  const serviceClient = createServiceClient()
  const { error: deleteError } = await serviceClient.from('app_settings').delete().eq('key', key)

  if (deleteError) {
    console.error('[App Settings Error]', {
      type: 'remove_setting',
      key,
      timestamp: new Date().toISOString(),
      error: deleteError.message,
    })
    return { error: `Failed to remove setting: ${deleteError.message}` }
  }

  revalidatePath('/app-settings/integrations')
  return { success: true }
}

export async function testAppConnection(
  key: string
): Promise<{ success: boolean; message: string }> {
  const { error, userRecord } = await requireInternalUser()
  if (error) return { success: false, message: error }
  if (userRecord!.role !== 'admin' && !userRecord!.is_internal)
    return { success: false, message: 'Admin access required' }

  const { getAppCredential } = await import('@/lib/app-settings/credentials')
  const credential = await getAppCredential(key)

  if (!credential) {
    return { success: false, message: 'No credential configured' }
  }

  try {
    switch (key) {
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': credential,
            'anthropic-version': '2023-06-01',
          },
        })
        if (!res.ok) {
          const body = await res.text()
          return {
            success: false,
            message: `API returned ${res.status}: ${body.slice(0, 200)}`,
          }
        }
        return { success: true, message: 'Connected successfully' }
      }

      case 'resend': {
        const res = await fetch('https://api.resend.com/api-keys', {
          headers: { Authorization: `Bearer ${credential}` },
        })
        if (!res.ok) {
          return { success: false, message: `API returned ${res.status}` }
        }
        return { success: true, message: 'Connected successfully' }
      }

      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${credential}` },
        })
        if (!res.ok) {
          const body = await res.text()
          return {
            success: false,
            message: `API returned ${res.status}: ${body.slice(0, 200)}`,
          }
        }
        return { success: true, message: 'Connected successfully' }
      }

      case 'perplexity': {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        })
        if (!res.ok) {
          const body = await res.text()
          return {
            success: false,
            message: `API returned ${res.status}: ${body.slice(0, 200)}`,
          }
        }
        return { success: true, message: 'Connected successfully' }
      }

      case 'pagespeed': {
        const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://google.com&key=${credential}&category=performance&strategy=mobile`
        const res = await fetch(url)
        if (!res.ok) {
          return { success: false, message: `API returned ${res.status}` }
        }
        return { success: true, message: 'Connected successfully' }
      }

      default:
        return { success: false, message: 'Test not available for this service' }
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

export async function updateEmailConfig(fromName: string, fromEmail: string) {
  return updateAppSetting(
    'email_config',
    JSON.stringify({ from_name: fromName, from_email: fromEmail })
  )
}
