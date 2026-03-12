import { createServiceClient } from '@/lib/supabase/server'
import { decryptCredentials } from '@/lib/utils/crypto'

export const ENV_VAR_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  resend: 'RESEND_API_KEY',
  pagespeed: 'PAGESPEED_API_KEY',
  cron_secret: 'CRON_SECRET',
}

/** Credential value key within the decrypted JSONB per setting type */
const CREDENTIAL_FIELD: Record<string, string> = {
  anthropic: 'api_key',
  resend: 'api_key',
  pagespeed: 'api_key',
  cron_secret: 'secret',
}

/**
 * Resolve an app-level credential.
 * Checks app_settings table first (via SECURITY DEFINER RPC), falls back to env var.
 */
export async function getAppCredential(key: string): Promise<string | null> {
  try {
    const supabase = await createServiceClient()
    const { data } = await supabase.rpc('get_app_credential', { setting_key: key })

    if (data) {
      const decrypted = decryptCredentials<Record<string, string>>(data)
      const field = CREDENTIAL_FIELD[key] ?? 'api_key'
      return decrypted[field] ?? null
    }
  } catch (error) {
    console.error('[App Settings Error]', {
      type: 'credential_resolution',
      key,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Fallback to env var
  const envVar = ENV_VAR_MAP[key]
  return envVar ? (process.env[envVar] ?? null) : null
}

/**
 * Mask a credential string for display — shows last 6 characters.
 * Returns null if the input is empty or too short.
 */
export function maskCredential(value: string): string | null {
  if (!value || value.length < 6) return null
  const visible = value.slice(-6)
  return `${'•'.repeat(Math.min(value.length - 6, 20))}${visible}`
}
