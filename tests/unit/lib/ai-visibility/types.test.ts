import { describe, it, expect } from 'vitest'
import { AIPlatform, BrandSentiment, SyncFrequency, PromptSource } from '@/lib/enums'
import {
  type AIVisibilityConfig,
  type AIVisibilityTopic,
  type AIVisibilityPrompt,
  type AIVisibilityResult,
  type AIVisibilityScore,
  PLATFORM_DISPLAY_NAMES,
  SENTIMENT_DISPLAY_NAMES,
  ALL_PLATFORMS,
} from '@/lib/ai-visibility/types'

describe('AI Visibility types', () => {
  it('exports display name maps for all platforms', () => {
    expect(PLATFORM_DISPLAY_NAMES[AIPlatform.ChatGPT]).toBe('ChatGPT')
    expect(PLATFORM_DISPLAY_NAMES[AIPlatform.Claude]).toBe('Claude')
    expect(PLATFORM_DISPLAY_NAMES[AIPlatform.Perplexity]).toBe('Perplexity')
  })

  it('exports display name maps for all sentiments', () => {
    expect(SENTIMENT_DISPLAY_NAMES[BrandSentiment.Positive]).toBe('Positive')
    expect(SENTIMENT_DISPLAY_NAMES[BrandSentiment.Neutral]).toBe('Neutral')
    expect(SENTIMENT_DISPLAY_NAMES[BrandSentiment.Negative]).toBe('Negative')
  })

  it('ALL_PLATFORMS contains all platform values', () => {
    expect(ALL_PLATFORMS).toEqual([AIPlatform.ChatGPT, AIPlatform.Claude, AIPlatform.Perplexity])
  })

  it('type-checks a config object', () => {
    const config: AIVisibilityConfig = {
      id: 'cfg-1',
      organization_id: 'org-1',
      sync_frequency: SyncFrequency.Daily,
      platforms: [AIPlatform.ChatGPT, AIPlatform.Claude],
      is_active: true,
      monthly_budget_cents: 10000,
      budget_alert_threshold: 90,
      last_alert_sent_at: null,
      last_alert_type: null,
      last_sync_at: null,
      created_at: '2026-04-09T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    }
    expect(config.monthly_budget_cents).toBe(10000)
  })

  it('type-checks a result object', () => {
    const result: AIVisibilityResult = {
      id: 'res-1',
      prompt_id: 'prompt-1',
      organization_id: 'org-1',
      platform: AIPlatform.ChatGPT,
      response_text: 'Warby Parker is a great option...',
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: true,
      cited_urls: ['https://warbyparker.com/glasses'],
      competitor_mentions: [{ name: 'Zenni', mentioned: true, cited: false }],
      tokens_used: 500,
      cost_cents: 2,
      queried_at: '2026-04-09T00:00:00Z',
      raw_response: null,
      created_at: '2026-04-09T00:00:00Z',
    }
    expect(result.brand_mentioned).toBe(true)
  })
})
