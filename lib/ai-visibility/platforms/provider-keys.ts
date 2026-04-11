import { AIPlatform } from '@/lib/enums'
import { getAppCredential } from '@/lib/app-settings/credentials'
import { ALL_PLATFORMS } from '@/lib/ai-visibility/types'

/**
 * Map AI platform enum to the provider key used in usage logging.
 * ChatGPT uses the 'openai' provider key; others match their enum value.
 */
export const PLATFORM_PROVIDER_KEYS: Record<AIPlatform, string> = {
  [AIPlatform.ChatGPT]: 'openai',
  [AIPlatform.Claude]: 'anthropic',
  [AIPlatform.Perplexity]: 'perplexity',
}

/**
 * Map AI platform enum to the credential key used in getAppCredential().
 * Claude uses the 'anthropic' credential; ChatGPT uses 'openai'.
 */
export const PLATFORM_CREDENTIAL_KEYS: Record<AIPlatform, string> = {
  [AIPlatform.ChatGPT]: 'openai',
  [AIPlatform.Claude]: 'anthropic',
  [AIPlatform.Perplexity]: 'perplexity',
}

/**
 * Check which AI platforms have credentials configured (DB or env var).
 * Returns the list of platforms that are ready to use.
 */
export async function getAvailablePlatforms(): Promise<AIPlatform[]> {
  const checks = await Promise.all(
    ALL_PLATFORMS.map(async (platform) => {
      const credential = await getAppCredential(PLATFORM_CREDENTIAL_KEYS[platform])
      return { platform, available: !!credential }
    })
  )
  return checks.filter((c) => c.available).map((c) => c.platform)
}
