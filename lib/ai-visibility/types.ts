import { AIPlatform, BrandSentiment, SyncFrequency, PromptSource } from '@/lib/enums'

// Re-export for convenience
export { AIPlatform, BrandSentiment, SyncFrequency, PromptSource }

// =============================================================================
// Display Name Maps
// =============================================================================

export const PLATFORM_DISPLAY_NAMES: Record<AIPlatform, string> = {
  [AIPlatform.ChatGPT]: 'ChatGPT',
  [AIPlatform.Claude]: 'Claude',
  [AIPlatform.Perplexity]: 'Perplexity',
}

export const SENTIMENT_DISPLAY_NAMES: Record<BrandSentiment, string> = {
  [BrandSentiment.Positive]: 'Positive',
  [BrandSentiment.Neutral]: 'Neutral',
  [BrandSentiment.Negative]: 'Negative',
}

export const ALL_PLATFORMS: AIPlatform[] = [
  AIPlatform.ChatGPT,
  AIPlatform.Claude,
  AIPlatform.Perplexity,
]

// =============================================================================
// Database Row Types
// =============================================================================

export interface AIVisibilityConfig {
  id: string
  organization_id: string
  sync_frequency: SyncFrequency
  platforms: AIPlatform[]
  is_active: boolean
  monthly_budget_cents: number
  budget_alert_threshold: number
  competitors: { name: string; domain: string }[]
  last_alert_sent_at: string | null
  last_alert_type: string | null
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface AIVisibilityTopic {
  id: string
  organization_id: string
  name: string
  source: PromptSource
  is_active: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AIVisibilityPrompt {
  id: string
  topic_id: string
  organization_id: string
  prompt_text: string
  source: PromptSource
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompetitorMention {
  name: string
  mentioned: boolean
  cited: boolean
}

export interface AIVisibilityResult {
  id: string
  prompt_id: string | null
  organization_id: string
  platform: AIPlatform
  response_text: string
  brand_mentioned: boolean
  brand_sentiment: BrandSentiment
  brand_position: number | null
  domain_cited: boolean
  cited_urls: string[]
  competitor_mentions: CompetitorMention[] | null
  tokens_used: number | null
  cost_cents: number | null
  queried_at: string
  raw_response: Record<string, unknown> | null
  research_id: string | null
  source: 'sync' | 'research'
  insight: string | null
  created_at: string
}

export interface PlatformBreakdown {
  [platform: string]: {
    mentions: number
    citations: number
  }
}

export interface AIVisibilityScore {
  id: string
  organization_id: string
  score: number
  mentions_count: number
  citations_count: number
  cited_pages_count: number
  platform_breakdown: PlatformBreakdown | null
  period_start: string
  period_end: string
  created_at: string
}
