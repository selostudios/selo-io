import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform, BrandSentiment } from '@/lib/enums'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/platforms/registry', () => ({
  getAdapter: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/analyzer', () => ({
  analyzeResponse: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/budget', () => ({
  getCurrentMonthSpend: vi.fn(),
  canContinueSync: vi.fn(),
  checkBudgetThresholds: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/alerts', () => ({
  sendBudgetAlert: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/scorer', () => ({
  calculateVisibilityScore: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/context', () => ({
  buildOrgContext: vi.fn(),
}))

vi.mock('@/lib/app-settings/usage', () => ({
  logUsage: vi.fn(),
}))

import { syncOrganization } from '@/lib/ai-visibility/sync'
import { getAdapter } from '@/lib/ai-visibility/platforms/registry'
import { analyzeResponse } from '@/lib/ai-visibility/analyzer'
import {
  getCurrentMonthSpend,
  canContinueSync,
  checkBudgetThresholds,
} from '@/lib/ai-visibility/budget'
import { sendBudgetAlert } from '@/lib/ai-visibility/alerts'
import { calculateVisibilityScore } from '@/lib/ai-visibility/scorer'
import { buildOrgContext } from '@/lib/ai-visibility/context'
import { createServiceClient } from '@/lib/supabase/server'

describe('syncOrganization', () => {
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockSelectPrompts = vi.fn()

  const makeConfig = (overrides = {}) => ({
    id: 'config-1',
    organization_id: 'org-1',
    platforms: [AIPlatform.ChatGPT] as AIPlatform[],
    monthly_budget_cents: 10000,
    budget_alert_threshold: 90,
    last_alert_type: null,
    last_alert_sent_at: null,
    competitors: [],
    sync_frequency: 'daily' as const,
    is_active: true,
    last_sync_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getCurrentMonthSpend).mockResolvedValue(1000)
    vi.mocked(canContinueSync).mockReturnValue(true)
    vi.mocked(checkBudgetThresholds).mockReturnValue(null)

    const mockAdapter = {
      platform: AIPlatform.ChatGPT,
      query: vi.fn().mockResolvedValue({
        text: 'Brand X is great.',
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
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: false,
      cited_urls: [],
      competitor_mentions: null,
      sentiment_cost_cents: 1,
    })

    vi.mocked(buildOrgContext).mockReturnValue({
      brandName: 'Test Brand',
      domain: 'testbrand.com',
      competitors: [],
    })

    vi.mocked(calculateVisibilityScore).mockReturnValue(75)

    mockInsert.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockSelectPrompts.mockResolvedValue({
      data: [
        { id: 'prompt-1', prompt_text: 'Tell me about Test Brand' },
        { id: 'prompt-2', prompt_text: 'Best brands in category' },
      ],
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'ai_visibility_prompts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockSelectPrompts,
              }),
            }),
          }
        }
        if (table === 'ai_visibility_results') return { insert: mockInsert }
        if (table === 'ai_visibility_scores') return { insert: mockInsert }
        if (table === 'ai_visibility_configs') return { update: mockUpdate }
        return {}
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  it('queries each prompt on each platform and stores results', async () => {
    const result = await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: makeConfig(),
    })

    expect(result.queriesCompleted).toBe(2)
    expect(result.totalCostCents).toBeGreaterThan(0)
    expect(result.budgetExceeded).toBe(false)
  })

  it('stops syncing when budget is exceeded mid-run', async () => {
    vi.mocked(canContinueSync)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const result = await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: makeConfig({ monthly_budget_cents: 100 }),
    })

    expect(result.queriesCompleted).toBe(1)
    expect(result.budgetExceeded).toBe(true)
  })

  it('sends budget alert when threshold is crossed', async () => {
    vi.mocked(checkBudgetThresholds).mockReturnValue('approaching')

    await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: makeConfig(),
    })

    expect(sendBudgetAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: 'approaching',
        orgName: 'Test Brand',
      })
    )
  })

  it('skips entirely when budget already exceeded', async () => {
    vi.mocked(canContinueSync).mockReturnValue(false)

    const result = await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: makeConfig({ monthly_budget_cents: 100 }),
    })

    expect(result.queriesCompleted).toBe(0)
    expect(result.budgetExceeded).toBe(true)
  })
})
