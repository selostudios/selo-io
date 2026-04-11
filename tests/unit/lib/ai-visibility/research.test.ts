import { describe, test, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/budget', () => ({
  getCurrentMonthSpend: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/context', () => ({
  buildOrgContext: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/platforms/registry', () => ({
  getAdapter: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/analyzer', () => ({
  analyzeResponse: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/insights', () => ({
  generateInsight: vi.fn(),
}))

vi.mock('@/lib/app-settings/usage', () => ({
  logUsage: vi.fn(),
}))

import { prepareResearch, executeResearch, getResearchResults } from '@/lib/ai-visibility/research'
import { getCurrentMonthSpend } from '@/lib/ai-visibility/budget'
import { buildOrgContext } from '@/lib/ai-visibility/context'
import { getAdapter } from '@/lib/ai-visibility/platforms/registry'
import { analyzeResponse } from '@/lib/ai-visibility/analyzer'
import { generateInsight } from '@/lib/ai-visibility/insights'
import { logUsage } from '@/lib/app-settings/usage'
import { createServiceClient } from '@/lib/supabase/server'

describe('prepareResearch', () => {
  const mockMaybeSingle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getCurrentMonthSpend).mockResolvedValue(5000) // $50.00

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'config-1',
        organization_id: 'org-1',
        platforms: [AIPlatform.ChatGPT, AIPlatform.Claude],
        is_active: true,
        monthly_budget_cents: 10000,
        budget_alert_threshold: 90,
        competitors: [{ name: 'Rival', domain: 'rival.com' }],
      },
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  test('returns research config with platforms and budget status', async () => {
    const result = await prepareResearch('org-1')

    expect(result.researchId).toBeDefined()
    expect(result.platforms).toEqual([AIPlatform.ChatGPT, AIPlatform.Claude])
    expect(result.budgetWarning).toBe(false) // 5000 < 10000
    expect(result.monthlySpendCents).toBe(5000)
    expect(result.monthlyBudgetCents).toBe(10000)
  })

  test('sets budgetWarning when spend exceeds budget', async () => {
    vi.mocked(getCurrentMonthSpend).mockResolvedValueOnce(15000) // $150 > $100

    const result = await prepareResearch('org-1')

    expect(result.budgetWarning).toBe(true)
  })

  test('generates a unique researchId', async () => {
    const r1 = await prepareResearch('org-1')
    const r2 = await prepareResearch('org-1')

    expect(r1.researchId).not.toBe(r2.researchId)
  })

  test('throws when config is not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await expect(prepareResearch('org-1')).rejects.toThrow(
      'AI Visibility not configured for this organization'
    )
  })

  test('no budget warning when budget is zero (unlimited)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'config-1',
        organization_id: 'org-1',
        platforms: [AIPlatform.ChatGPT],
        is_active: true,
        monthly_budget_cents: 0,
        budget_alert_threshold: 90,
        competitors: [],
      },
      error: null,
    })

    const result = await prepareResearch('org-1')

    expect(result.budgetWarning).toBe(false)
  })
})

describe('executeResearch', () => {
  const mockInsert = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        insert: mockInsert,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockInsert.mockResolvedValue({ error: null })

    vi.mocked(buildOrgContext).mockReturnValue({
      brandName: 'Example Co',
      domain: 'example.com',
      competitors: ['Rival'],
      competitorDomains: { Rival: 'rival.com' },
    })

    const mockAdapter = {
      platform: AIPlatform.ChatGPT,
      query: vi.fn().mockResolvedValue({
        text: 'Example Co is a great company.',
        citations: [],
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 200,
        costCents: 3,
      }),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter)

    vi.mocked(analyzeResponse).mockResolvedValue({
      brand_mentioned: true,
      brand_sentiment: 'positive',
      brand_position: 1,
      domain_cited: false,
      cited_urls: [],
      competitor_mentions: null,
      sentiment_cost_cents: 1,
    })

    vi.mocked(generateInsight).mockResolvedValue({
      insight: 'Your brand is well-positioned.',
      costCents: 2,
    })
  })

  test('queries all platforms and stores results', async () => {
    await executeResearch(
      'org-1',
      'research-123',
      'test prompt',
      [AIPlatform.ChatGPT, AIPlatform.Claude],
      'https://example.com',
      'Example Co',
      [{ name: 'Rival', domain: 'rival.com' }]
    )

    expect(getAdapter).toHaveBeenCalledTimes(2)
    expect(mockInsert).toHaveBeenCalledTimes(2)
    expect(logUsage).toHaveBeenCalledTimes(2)
  })

  test('stores result with correct fields including insight and cost', async () => {
    await executeResearch(
      'org-1',
      'research-123',
      'test prompt',
      [AIPlatform.ChatGPT],
      'https://example.com',
      'Example Co',
      []
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        research_id: 'research-123',
        source: 'research',
        platform: AIPlatform.ChatGPT,
        brand_mentioned: true,
        insight: 'Your brand is well-positioned.',
        cost_cents: 6, // 3 (query) + 1 (sentiment) + 2 (insight)
      })
    )
  })

  test('logs usage with correct service name mapping for chatgpt', async () => {
    await executeResearch(
      'org-1',
      'research-123',
      'test prompt',
      [AIPlatform.ChatGPT],
      'https://example.com',
      'Example Co',
      []
    )

    expect(logUsage).toHaveBeenCalledWith('openai', 'research_query', expect.anything())
  })

  test('logs usage with platform name for non-chatgpt platforms', async () => {
    await executeResearch(
      'org-1',
      'research-123',
      'test prompt',
      [AIPlatform.Claude],
      'https://example.com',
      'Example Co',
      []
    )

    expect(logUsage).toHaveBeenCalledWith('anthropic', 'research_query', expect.anything())
  })

  test('continues with other platforms when one fails', async () => {
    const failingAdapter = {
      platform: AIPlatform.ChatGPT,
      query: vi.fn().mockRejectedValue(new Error('API timeout')),
    }
    const successAdapter = {
      platform: AIPlatform.Claude,
      query: vi.fn().mockResolvedValue({
        text: 'Response text',
        citations: [],
        model: 'claude-sonnet',
        inputTokens: 50,
        outputTokens: 100,
        costCents: 2,
      }),
    }

    vi.mocked(getAdapter).mockReturnValueOnce(failingAdapter).mockReturnValueOnce(successAdapter)

    await executeResearch(
      'org-1',
      'research-123',
      'test prompt',
      [AIPlatform.ChatGPT, AIPlatform.Claude],
      'https://example.com',
      'Example Co',
      []
    )

    // Only the successful platform inserts a result
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  test('handles null insight gracefully', async () => {
    vi.mocked(generateInsight).mockResolvedValueOnce(null)

    await executeResearch(
      'org-1',
      'research-123',
      'test prompt',
      [AIPlatform.ChatGPT],
      'https://example.com',
      'Example Co',
      []
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        insight: null,
        cost_cents: 4, // 3 (query) + 1 (sentiment) + 0 (no insight)
      })
    )
  })
})

describe('getResearchResults', () => {
  test('returns results ordered by creation time', async () => {
    const mockData = [
      { id: 'r1', platform: AIPlatform.ChatGPT, created_at: '2026-01-01' },
      { id: 'r2', platform: AIPlatform.Claude, created_at: '2026-01-02' },
    ]

    const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockOrder,
          })),
        })),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const results = await getResearchResults('research-123')

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('r1')
    expect(results[1].id).toBe('r2')
  })

  test('returns empty array when no results exist', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockOrder,
          })),
        })),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const results = await getResearchResults('nonexistent-id')

    expect(results).toEqual([])
  })

  test('returns empty array when data is null', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockOrder,
          })),
        })),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const results = await getResearchResults('research-123')

    expect(results).toEqual([])
  })
})
