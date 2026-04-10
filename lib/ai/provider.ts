import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createPerplexity } from '@ai-sdk/perplexity'
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

/**
 * Create an OpenAI provider with a key resolved from the database
 * (encrypted app_settings) first, falling back to the OPENAI_API_KEY env var.
 */
export async function getOpenAIProvider() {
  const apiKey = await getAppCredential('openai')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set it in App Settings > Integrations.')
  }
  return createOpenAI({ apiKey })
}

/**
 * Create a Perplexity provider with a key resolved from the database
 * (encrypted app_settings) first, falling back to the PERPLEXITY_API_KEY env var.
 */
export async function getPerplexityProvider() {
  const apiKey = await getAppCredential('perplexity')
  if (!apiKey) {
    throw new Error('Perplexity API key not configured. Set it in App Settings > Integrations.')
  }
  return createPerplexity({ apiKey })
}
