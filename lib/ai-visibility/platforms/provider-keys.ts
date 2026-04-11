import { AIPlatform } from '@/lib/enums'

/**
 * Map AI platform enum to the provider key used in usage logging.
 * ChatGPT uses the 'openai' provider key; others match their enum value.
 */
export const PLATFORM_PROVIDER_KEYS: Record<AIPlatform, string> = {
  [AIPlatform.ChatGPT]: 'openai',
  [AIPlatform.Claude]: 'claude',
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
