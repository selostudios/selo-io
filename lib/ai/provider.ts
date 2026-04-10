import { createAnthropic } from '@ai-sdk/anthropic'
import { getAppCredential } from '@/lib/app-settings/credentials'

/**
 * Create an Anthropic provider with a key resolved from the database
 * (encrypted app_settings) first, falling back to the ANTHROPIC_API_KEY env var.
 *
 * Must be called per-request since credential resolution is async.
 */
export async function getAnthropicProvider() {
  const apiKey = await getAppCredential('anthropic')
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Set it in App Settings > Integrations.')
  }
  return createAnthropic({ apiKey })
}
