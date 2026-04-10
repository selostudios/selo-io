import { describe, test, expect } from 'vitest'
import { groupResultsByPromptId, assembleTopicsWithPrompts } from '@/lib/ai-visibility/queries'
import { AIPlatform, BrandSentiment, PromptSource } from '@/lib/enums'
import type {
  AIVisibilityResult,
  AIVisibilityTopic,
  AIVisibilityPrompt,
} from '@/lib/ai-visibility/types'

// =============================================================================
// Test Factories
// =============================================================================

function makeResult(overrides: Partial<AIVisibilityResult> = {}): AIVisibilityResult {
  return {
    id: 'r-' + Math.random().toString(36).slice(2),
    prompt_id: 'p1',
    organization_id: 'org1',
    platform: AIPlatform.ChatGPT,
    response_text: 'Some AI response about the brand',
    brand_mentioned: true,
    brand_sentiment: BrandSentiment.Positive,
    brand_position: 1,
    domain_cited: false,
    cited_urls: [],
    competitor_mentions: null,
    tokens_used: 100,
    cost_cents: 1,
    queried_at: '2026-04-09T04:00:00Z',
    raw_response: null,
    created_at: '2026-04-09T04:00:00Z',
    ...overrides,
  }
}

function makeTopic(overrides: Partial<AIVisibilityTopic> = {}): AIVisibilityTopic {
  return {
    id: 't1',
    organization_id: 'org1',
    name: 'Test Topic',
    source: PromptSource.Manual,
    is_active: true,
    metadata: null,
    created_at: '2026-04-09T00:00:00Z',
    updated_at: '2026-04-09T00:00:00Z',
    ...overrides,
  }
}

function makePrompt(overrides: Partial<AIVisibilityPrompt> = {}): AIVisibilityPrompt {
  return {
    id: 'p1',
    topic_id: 't1',
    organization_id: 'org1',
    prompt_text: 'Best prescription glasses online',
    source: PromptSource.Manual,
    is_active: true,
    created_at: '2026-04-09T00:00:00Z',
    updated_at: '2026-04-09T00:00:00Z',
    ...overrides,
  }
}

// =============================================================================
// groupResultsByPromptId
// =============================================================================

describe('groupResultsByPromptId', () => {
  test('groups results by their prompt_id', () => {
    const results = [
      makeResult({ prompt_id: 'p1', platform: AIPlatform.ChatGPT }),
      makeResult({ prompt_id: 'p1', platform: AIPlatform.Claude }),
      makeResult({ prompt_id: 'p2', platform: AIPlatform.ChatGPT }),
    ]

    const grouped = groupResultsByPromptId(results)

    expect(grouped.get('p1')).toHaveLength(2)
    expect(grouped.get('p2')).toHaveLength(1)
    expect(grouped.has('p3')).toBe(false)
  })

  test('returns empty map for empty input', () => {
    expect(groupResultsByPromptId([]).size).toBe(0)
  })
})

// =============================================================================
// assembleTopicsWithPrompts
// =============================================================================

describe('assembleTopicsWithPrompts', () => {
  test('attaches prompts to their parent topics with results', () => {
    const topics = [
      makeTopic({ id: 't1', name: 'Glasses' }),
      makeTopic({ id: 't2', name: 'Lenses' }),
    ]
    const prompts = [
      makePrompt({ id: 'p1', topic_id: 't1' }),
      makePrompt({ id: 'p2', topic_id: 't1' }),
      makePrompt({ id: 'p3', topic_id: 't2' }),
    ]
    const resultsByPrompt = new Map([['p1', [makeResult({ prompt_id: 'p1' })]]])

    const assembled = assembleTopicsWithPrompts(topics, prompts, resultsByPrompt)

    expect(assembled).toHaveLength(2)
    expect(assembled[0].prompts).toHaveLength(2)
    expect(assembled[0].prompts[0].results).toHaveLength(1)
    expect(assembled[0].prompts[1].results).toHaveLength(0)
    expect(assembled[1].prompts).toHaveLength(1)
    expect(assembled[1].prompts[0].results).toHaveLength(0)
  })

  test('returns topics with empty prompts array when no prompts exist', () => {
    const topics = [makeTopic({ id: 't1' })]
    const assembled = assembleTopicsWithPrompts(topics, [], new Map())

    expect(assembled[0].prompts).toHaveLength(0)
  })
})
