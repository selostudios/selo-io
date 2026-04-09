import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter } from './types'
import { ChatGPTAdapter } from './chatgpt/adapter'
import { ClaudeAdapter } from './claude/adapter'
import { PerplexityAdapter } from './perplexity/adapter'

const adapters: Record<AIPlatform, () => AIProviderAdapter> = {
  [AIPlatform.ChatGPT]: () => new ChatGPTAdapter(),
  [AIPlatform.Claude]: () => new ClaudeAdapter(),
  [AIPlatform.Perplexity]: () => new PerplexityAdapter(),
}

export function getAdapter(platform: AIPlatform): AIProviderAdapter {
  const factory = adapters[platform]
  if (!factory) {
    throw new Error(`No adapter for platform: ${platform}`)
  }
  return factory()
}

export function getAdapters(platforms: AIPlatform[]): AIProviderAdapter[] {
  return platforms.map(getAdapter)
}
