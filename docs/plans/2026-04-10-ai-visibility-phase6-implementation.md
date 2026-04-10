# AI Visibility Phase 6 — Research Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add on-demand prompt querying with AI-generated insights to the AI Visibility Prompts page.

**Architecture:** Server action starts research and returns immediately. Background API route executes platform queries in parallel via `after()`, stores results progressively. Client polls for results using a new generic `usePolling` hook. Each result gets an AI-generated insight from Claude Haiku.

**Tech Stack:** Next.js server actions + API route with `after()`, Vercel AI SDK (`generateText`), Supabase, Vitest, React

---

## Task 1: Database Migration — Research Columns

**Files:**

- Create: `supabase/migrations/20260410120000_add_research_columns_to_ai_visibility_results.sql`

**Step 1: Create the migration**

Create `supabase/migrations/20260410120000_add_research_columns_to_ai_visibility_results.sql`:

```sql
-- Add research mode columns to ai_visibility_results
ALTER TABLE ai_visibility_results
  ADD COLUMN IF NOT EXISTS research_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'sync',
  ADD COLUMN IF NOT EXISTS insight TEXT;

-- Make prompt_id nullable (research results don't have a prompt)
ALTER TABLE ai_visibility_results
  ALTER COLUMN prompt_id DROP NOT NULL;

-- Index for polling research results by research_id
CREATE INDEX IF NOT EXISTS idx_ai_visibility_results_research_id
  ON ai_visibility_results (research_id)
  WHERE research_id IS NOT NULL;

-- Add check constraint for source values
ALTER TABLE ai_visibility_results
  ADD CONSTRAINT ai_visibility_results_source_check
  CHECK (source IN ('sync', 'research'));
```

**Step 2: Update the AIVisibilityResult type**

In `lib/ai-visibility/types.ts`, update the `AIVisibilityResult` interface to add the new fields:

```typescript
export interface AIVisibilityResult {
  id: string
  prompt_id: string | null // Changed: nullable for research results
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
  created_at: string
  // Research mode fields
  research_id: string | null
  source: 'sync' | 'research'
  insight: string | null
}
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260410120000_add_research_columns_to_ai_visibility_results.sql lib/ai-visibility/types.ts
git commit -m "feat: add research mode columns to ai_visibility_results"
```

---

## Task 2: Generic Polling Hook

**Files:**

- Create: `hooks/use-polling.ts`
- Create: `tests/unit/hooks/use-polling.test.ts`

**Step 1: Write the polling hook tests**

Create `tests/unit/hooks/use-polling.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePolling } from '@/hooks/use-polling'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('polls at the specified interval', async () => {
    let callCount = 0
    const fetcher = vi.fn(async () => {
      callCount++
      return { count: callCount }
    })

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        intervalMs: 1000,
        isComplete: (data) => data.count >= 3,
      })
    )

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)

    // Third poll — isComplete returns true, should stop
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)

    // No more polls
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  test('does not poll when disabled', async () => {
    const fetcher = vi.fn(async () => ({ done: false }))

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: false,
        isComplete: () => false,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(fetcher).not.toHaveBeenCalled()
  })

  test('calls onComplete when isComplete returns true', async () => {
    const onComplete = vi.fn()
    const fetcher = vi.fn(async () => ({ done: true }))

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        isComplete: (data) => data.done,
        onComplete,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(onComplete).toHaveBeenCalledWith({ done: true })
  })

  test('uses error interval on fetch failure', async () => {
    let callCount = 0
    const fetcher = vi.fn(async () => {
      callCount++
      if (callCount === 1) throw new Error('Network error')
      return { ok: true }
    })

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        intervalMs: 1000,
        errorIntervalMs: 3000,
        isComplete: (data) => data.ok,
      })
    )

    // First call fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Should wait 3000ms (error interval), not 1000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1) // Still 1

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2) // Now 2
  })

  test('returns isLoading true until first successful fetch', async () => {
    const fetcher = vi.fn(async () => ({ value: 42 }))

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        isComplete: () => false,
      })
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual({ value: 42 })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/hooks/use-polling.test.ts`

Expected: FAIL — module not found.

**Step 3: Create the generic polling hook**

Create `hooks/use-polling.ts`:

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  enabled: boolean
  intervalMs?: number
  errorIntervalMs?: number
  isComplete: (data: T) => boolean
  onComplete?: (data: T) => void
}

export interface UsePollingResult<T> {
  data: T | null
  isLoading: boolean
}

export function usePolling<T>({
  fetcher,
  enabled,
  intervalMs = 2000,
  errorIntervalMs = 5000,
  isComplete,
  onComplete,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const isCompleteRef = useRef(isComplete)
  isCompleteRef.current = isComplete

  useEffect(() => {
    if (!enabled) return

    let timeoutId: NodeJS.Timeout
    let cancelled = false

    const poll = async () => {
      try {
        const result = await fetcher()
        if (cancelled) return
        setData(result)
        setIsLoading(false)

        if (isCompleteRef.current(result)) {
          onCompleteRef.current?.(result)
          return
        }

        timeoutId = setTimeout(poll, intervalMs)
      } catch {
        if (cancelled) return
        timeoutId = setTimeout(poll, errorIntervalMs)
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [enabled, fetcher, intervalMs, errorIntervalMs])

  return { data, isLoading }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/hooks/use-polling.test.ts`

Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add hooks/use-polling.ts tests/unit/hooks/use-polling.test.ts
git commit -m "feat: add generic usePolling hook for shared polling logic"
```

---

## Task 3: Refactor Audit Polling to Use Generic Hook

**Files:**

- Modify: `hooks/use-unified-audit-polling.ts`

**Step 1: Refactor to use `usePolling`**

Replace the contents of `hooks/use-unified-audit-polling.ts`. Keep the same public API but delegate core polling to `usePolling`. The audit-specific batch continuation logic stays in this wrapper.

```typescript
'use client'

import { useState, useRef, useCallback } from 'react'
import { UnifiedAuditStatus } from '@/lib/enums'
import { usePolling } from './use-polling'

interface UnifiedAuditProgress {
  id: string
  status: string
  url: string
  crawl_mode: string
  pages_crawled: number
  overall_score: number | null
  seo_score: number | null
  performance_score: number | null
  ai_readiness_score: number | null
  failed_count: number
  warning_count: number
  passed_count: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  progress: {
    phase: string
    crawl: { status: string; pagesCrawled: number; maxPages: number }
    analysis: {
      checks: { status: string; completed: number; total: number }
      psi: { status: string; completed: number; total: number }
      ai: { status: string; completed: number; total: number }
    }
    scoring: { status: string }
  }
}

const TERMINAL_STATUSES = new Set([
  UnifiedAuditStatus.Completed,
  UnifiedAuditStatus.CompletedWithErrors,
  UnifiedAuditStatus.Failed,
  UnifiedAuditStatus.Stopped,
])

export function useUnifiedAuditPolling(auditId: string, enabled: boolean) {
  const [isContinuing, setIsContinuing] = useState(false)
  const isContinuingRef = useRef(false)

  const triggerContinue = useCallback(async () => {
    if (isContinuingRef.current) return
    isContinuingRef.current = true
    setIsContinuing(true)

    try {
      const response = await fetch(`/api/unified-audit/${auditId}/continue`, {
        method: 'POST',
      })
      if (!response.ok) {
        console.error('[Unified Audit Continue Error]', {
          type: 'continue_request_failed',
          auditId,
          status: response.status,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[Unified Audit Continue Error]', {
        type: 'continue_request_error',
        auditId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setTimeout(() => {
        isContinuingRef.current = false
        setIsContinuing(false)
      }, 1000)
    }
  }, [auditId])

  const fetcher = useCallback(async (): Promise<UnifiedAuditProgress> => {
    const response = await fetch(`/api/unified-audit/${auditId}/status`)
    const data = await response.json()

    // Trigger batch continuation if needed (side effect during fetch)
    if (data.status === UnifiedAuditStatus.BatchComplete && !isContinuingRef.current) {
      triggerContinue()
    }

    return data
  }, [auditId, triggerContinue])

  const { data: progress, isLoading } = usePolling<UnifiedAuditProgress>({
    fetcher,
    enabled,
    intervalMs: 2000,
    errorIntervalMs: 5000,
    isComplete: (data) => TERMINAL_STATUSES.has(data.status as UnifiedAuditStatus),
  })

  return { progress, isLoading, isContinuing }
}
```

**Step 2: Run existing unified audit tests (if any) and do a build check**

Run: `npm run build`

Expected: Build succeeds — public API is unchanged.

**Step 3: Commit**

```bash
git add hooks/use-unified-audit-polling.ts
git commit -m "refactor: use generic usePolling hook in unified audit polling"
```

---

## Task 4: Insight Generator

**Files:**

- Create: `lib/ai-visibility/insights.ts`
- Create: `tests/unit/lib/ai-visibility/insights.test.ts`

**Step 1: Write insight generator tests**

Create `tests/unit/lib/ai-visibility/insights.test.ts`:

```typescript
import { describe, test, expect, vi } from 'vitest'
import { buildInsightPrompt } from '@/lib/ai-visibility/insights'
import { BrandSentiment, AIPlatform } from '@/lib/enums'
import type { AnalyzedResponse } from '@/lib/ai-visibility/analyzer'

const baseContext = {
  brandName: 'Acme',
  domain: 'acme.com',
  competitors: ['BigCorp', 'SmallCo'],
  competitorDomains: { BigCorp: 'bigcorp.com', SmallCo: 'smallco.com' } as Record<string, string>,
}

describe('buildInsightPrompt', () => {
  test('generates not-mentioned prompt when brand absent', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: false,
      brand_sentiment: BrandSentiment.Neutral,
      brand_position: null,
      domain_cited: false,
      cited_urls: ['https://bigcorp.com/blog'],
      competitor_mentions: [
        { name: 'BigCorp', mentioned: true, cited: true },
        { name: 'SmallCo', mentioned: false, cited: false },
      ],
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Some AI response text', analysis, baseContext)
    expect(prompt).toContain('not mentioned')
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('acme.com')
    expect(prompt).toContain('BigCorp')
  })

  test('generates low-position prompt when mentioned late', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Neutral,
      brand_position: 3,
      domain_cited: false,
      cited_urls: [],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Response mentioning Acme third', analysis, baseContext)
    expect(prompt).toContain('position 3')
    expect(prompt).toContain('move up')
  })

  test('generates negative-sentiment prompt', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Negative,
      brand_position: 1,
      domain_cited: true,
      cited_urls: ['https://acme.com'],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Negative response about Acme', analysis, baseContext)
    expect(prompt).toContain('negative')
    expect(prompt).toContain('sentiment')
  })

  test('generates positive prompt when all good', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: true,
      cited_urls: ['https://acme.com'],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Great response about Acme', analysis, baseContext)
    expect(prompt).toContain('working well')
  })

  test('generates not-cited prompt when mentioned but not cited', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: false,
      cited_urls: ['https://bigcorp.com'],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Response with Acme not cited', analysis, baseContext)
    expect(prompt).toContain('not cited')
    expect(prompt).toContain('cited source')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/ai-visibility/insights.test.ts`

Expected: FAIL.

**Step 3: Create the insight generator**

Create `lib/ai-visibility/insights.ts`:

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { BrandSentiment } from '@/lib/enums'
import type { AnalyzedResponse } from './analyzer'
import type { OrgContext } from './context'

/**
 * Build the prompt for Claude Haiku to generate an actionable insight.
 * Exported for testing — the actual API call is in generateInsight().
 */
export function buildInsightPrompt(
  responseText: string,
  analysis: AnalyzedResponse,
  context: OrgContext
): string {
  const { brandName, domain, competitors, competitorDomains } = context

  const competitorInfo = competitors?.length
    ? `Competitors: ${competitors.map((c) => `${c} (${competitorDomains?.[c] ?? 'unknown domain'})`).join(', ')}.`
    : ''

  const citedInfo = analysis.cited_urls.length
    ? `URLs cited in the response: ${analysis.cited_urls.join(', ')}.`
    : 'No URLs were cited in the response.'

  const competitorMentionInfo = analysis.competitor_mentions?.length
    ? `Competitor mentions: ${analysis.competitor_mentions.map((c) => `${c.name}: ${c.mentioned ? 'mentioned' : 'not mentioned'}, ${c.cited ? 'cited' : 'not cited'}`).join('; ')}.`
    : ''

  let situationContext: string
  let focus: string

  if (!analysis.brand_mentioned) {
    situationContext = `The brand "${brandName}" (${domain}) was not mentioned in this AI response.`
    focus =
      'Explain why the brand was likely not mentioned and provide 2-3 specific, actionable steps to get mentioned in responses to this type of query.'
  } else if (analysis.brand_sentiment === BrandSentiment.Negative) {
    situationContext = `The brand "${brandName}" was mentioned but with negative sentiment.`
    focus =
      'Identify what in the response drives the negative sentiment toward the brand and suggest 2-3 specific actions to improve how AI platforms perceive the brand.'
  } else if (analysis.brand_position !== null && analysis.brand_position >= 2) {
    situationContext = `The brand "${brandName}" was mentioned at position ${analysis.brand_position} (not first).`
    focus =
      'Explain why the brand appears lower and suggest 2-3 specific actions to move up in AI response rankings for this type of query.'
  } else if (!analysis.domain_cited) {
    situationContext = `The brand "${brandName}" was mentioned but its website (${domain}) was not cited as a source.`
    focus =
      'Explain why the brand is mentioned but not cited and suggest 2-3 specific actions to become a cited source in AI responses.'
  } else {
    situationContext = `The brand "${brandName}" was mentioned positively at position ${analysis.brand_position ?? 'N/A'} and its website is cited.`
    focus =
      'Briefly explain what is working well for this brand in AI visibility and suggest 1-2 ways to maintain or strengthen this position.'
  }

  return `You are an AI visibility consultant. Analyze this AI platform response and provide actionable insights.

Brand: ${brandName}
Website: ${domain}
${competitorInfo}

${situationContext}

AI platform response:
"""
${responseText.slice(0, 2000)}
"""

${citedInfo}
${competitorMentionInfo}

${focus}

Be specific and actionable. Reference the actual response content, competitors mentioned, and URLs cited. Keep your response under 150 words. Use bullet points.`
}

/**
 * Generate an AI-powered insight for a research result.
 * Returns null on failure (never throws).
 */
export async function generateInsight(
  responseText: string,
  analysis: AnalyzedResponse,
  context: OrgContext
): Promise<{ insight: string; costCents: number } | null> {
  try {
    const prompt = buildInsightPrompt(responseText, analysis, context)

    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt,
      maxTokens: 300,
    })

    // Haiku pricing: $1 input / $5 output per million tokens
    const costCents =
      (result.usage.promptTokens * 1) / 10000 + (result.usage.completionTokens * 5) / 10000

    return {
      insight: result.text,
      costCents,
    }
  } catch (error) {
    console.error('[AI Visibility Insight Error]', {
      type: 'insight_generation_failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return null
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/insights.test.ts`

Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add lib/ai-visibility/insights.ts tests/unit/lib/ai-visibility/insights.test.ts
git commit -m "feat: add AI insight generator for research mode results"
```

---

## Task 5: Research Service

**Files:**

- Create: `lib/ai-visibility/research.ts`
- Create: `tests/unit/lib/ai-visibility/research.test.ts`

**Step 1: Write research service tests**

Create `tests/unit/lib/ai-visibility/research.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prepareResearch } from '@/lib/ai-visibility/research'
import { AIPlatform } from '@/lib/enums'

// Mock budget module
vi.mock('@/lib/ai-visibility/budget', () => ({
  getCurrentMonthSpend: vi.fn().mockResolvedValue(5000), // $50.00
}))

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
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
          }),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>()
  return {
    ...actual,
    createServiceClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
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
            }),
          })),
        })),
      })),
    })),
  }
})

describe('prepareResearch', () => {
  test('returns research config with platforms and budget status', async () => {
    const result = await prepareResearch(
      'org-1',
      'test prompt',
      'https://example.com',
      'Example Co'
    )

    expect(result.researchId).toBeDefined()
    expect(result.platforms).toEqual([AIPlatform.ChatGPT, AIPlatform.Claude])
    expect(result.budgetWarning).toBe(false) // 5000 < 10000
  })

  test('sets budgetWarning when spend exceeds budget', async () => {
    const { getCurrentMonthSpend } = await import('@/lib/ai-visibility/budget')
    vi.mocked(getCurrentMonthSpend).mockResolvedValueOnce(15000) // $150 > $100

    const result = await prepareResearch(
      'org-1',
      'test prompt',
      'https://example.com',
      'Example Co'
    )

    expect(result.budgetWarning).toBe(true)
  })

  test('generates a unique researchId', async () => {
    const r1 = await prepareResearch('org-1', 'prompt 1', 'https://example.com', 'Example Co')
    const r2 = await prepareResearch('org-1', 'prompt 2', 'https://example.com', 'Example Co')

    expect(r1.researchId).not.toBe(r2.researchId)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/ai-visibility/research.test.ts`

Expected: FAIL.

**Step 3: Create the research service**

Create `lib/ai-visibility/research.ts`:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentMonthSpend } from './budget'
import { buildOrgContext } from './context'
import { getAdapter } from './platforms/registry'
import { analyzeResponse } from './analyzer'
import { generateInsight } from './insights'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature, AIPlatform } from '@/lib/enums'
import type { AIVisibilityConfig } from './types'
import type { OrgContext } from './context'

export interface PrepareResearchResult {
  researchId: string
  platforms: AIPlatform[]
  budgetWarning: boolean
  monthlySpendCents: number
  monthlyBudgetCents: number
}

/**
 * Prepare a research query: check budget, load config, generate researchId.
 * Returns immediately — actual queries run in the background via API route.
 */
export async function prepareResearch(
  orgId: string,
  promptText: string,
  websiteUrl: string | null,
  orgName: string
): Promise<PrepareResearchResult> {
  const supabase = createServiceClient()

  // Load config
  const { data: config } = await supabase
    .from('ai_visibility_configs')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!config) {
    throw new Error('AI Visibility not configured for this organization')
  }

  // Check budget
  const monthlySpendCents = await getCurrentMonthSpend(orgId)
  const budgetWarning =
    config.monthly_budget_cents > 0 && monthlySpendCents >= config.monthly_budget_cents

  return {
    researchId: crypto.randomUUID(),
    platforms: config.platforms as AIPlatform[],
    budgetWarning,
    monthlySpendCents,
    monthlyBudgetCents: config.monthly_budget_cents,
  }
}

/**
 * Execute research queries for all platforms in parallel.
 * Called from the API route background via after().
 * Each result is stored individually as it completes.
 */
export async function executeResearch(
  orgId: string,
  researchId: string,
  promptText: string,
  platforms: AIPlatform[],
  websiteUrl: string | null,
  orgName: string,
  competitors: { name: string; domain: string }[]
): Promise<void> {
  const supabase = createServiceClient()
  const orgContext = buildOrgContext({ orgName, websiteUrl, competitors })
  const queriedAt = new Date().toISOString()

  await Promise.allSettled(
    platforms.map(async (platform) => {
      try {
        const adapter = getAdapter(platform)
        const response = await adapter.query(promptText)
        const analysis = await analyzeResponse(response, orgContext)

        // Generate insight
        const insightResult = await generateInsight(response.text, analysis, orgContext)

        // Calculate cost
        const queryCost =
          response.costCents + analysis.sentiment_cost_cents + (insightResult?.costCents ?? 0)

        // Store result
        await supabase.from('ai_visibility_results').insert({
          organization_id: orgId,
          prompt_id: null,
          research_id: researchId,
          source: 'research',
          platform,
          response_text: response.text,
          brand_mentioned: analysis.brand_mentioned,
          brand_sentiment: analysis.brand_sentiment,
          brand_position: analysis.brand_position,
          domain_cited: analysis.domain_cited,
          cited_urls: analysis.cited_urls,
          competitor_mentions: analysis.competitor_mentions,
          insight: insightResult?.insight ?? null,
          tokens_used: response.inputTokens + response.outputTokens,
          cost_cents: queryCost,
          queried_at: queriedAt,
          raw_response: null,
        })

        // Log usage
        await logUsage('ai_visibility', 'research_query', {
          organizationId: orgId,
          feature: UsageFeature.AIVisibility,
          cost: queryCost / 100,
          metadata: { platform, researchId, promptText: promptText.slice(0, 100) },
        })
      } catch (error) {
        console.error('[AI Visibility Research Error]', {
          type: 'platform_query_failed',
          platform,
          researchId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    })
  )
}

/**
 * Fetch research results by researchId.
 * Returns results that have arrived so far (for progressive polling).
 */
export async function getResearchResults(researchId: string): Promise<ResearchResult[]> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('ai_visibility_results')
    .select('*')
    .eq('research_id', researchId)
    .order('created_at', { ascending: true })

  return (data ?? []) as ResearchResult[]
}

export interface ResearchResult {
  id: string
  platform: AIPlatform
  response_text: string
  brand_mentioned: boolean
  brand_sentiment: string
  brand_position: number | null
  domain_cited: boolean
  cited_urls: string[]
  competitor_mentions: { name: string; mentioned: boolean; cited: boolean }[] | null
  insight: string | null
  cost_cents: number | null
  queried_at: string
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/research.test.ts`

Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add lib/ai-visibility/research.ts tests/unit/lib/ai-visibility/research.test.ts
git commit -m "feat: add research service for on-demand prompt querying"
```

---

## Task 6: Research API Route

**Files:**

- Create: `app/api/ai-visibility/research/start/route.ts`
- Create: `app/api/ai-visibility/research/[researchId]/results/route.ts`

**Step 1: Create the start route**

Create `app/api/ai-visibility/research/start/route.ts`:

```typescript
import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prepareResearch, executeResearch } from '@/lib/ai-visibility/research'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { orgId, promptText, websiteUrl, orgName, competitors } = body

  if (!orgId || !promptText?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const result = await prepareResearch(orgId, promptText, websiteUrl, orgName)

    // Fire queries in background
    after(async () => {
      await executeResearch(
        orgId,
        result.researchId,
        promptText,
        result.platforms,
        websiteUrl,
        orgName,
        competitors ?? []
      )
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Research Start Error]', {
      type: 'research_start_failed',
      orgId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start research' },
      { status: 500 }
    )
  }
}
```

**Step 2: Create the results route**

Create `app/api/ai-visibility/research/[researchId]/results/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResearchResults } from '@/lib/ai-visibility/research'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ researchId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { researchId } = await params

  const results = await getResearchResults(researchId)

  return NextResponse.json(results)
}
```

**Step 3: Run build to verify routes compile**

Run: `npm run build`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add app/api/ai-visibility/research/
git commit -m "feat: add research API routes for start and results polling"
```

---

## Task 7: Research Result Card Component

**Files:**

- Create: `components/ai-visibility/research-result-card.tsx`
- Create: `tests/unit/components/ai-visibility/research-result-card.test.tsx`

**Step 1: Write result card tests**

Create `tests/unit/components/ai-visibility/research-result-card.test.tsx`:

```typescript
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResearchResultCard } from '@/components/ai-visibility/research-result-card'
import { AIPlatform, BrandSentiment } from '@/lib/enums'

const baseResult = {
  id: '1',
  platform: AIPlatform.ChatGPT,
  response_text: 'Here are the best marketing tools for small businesses...',
  brand_mentioned: true,
  brand_sentiment: BrandSentiment.Positive,
  brand_position: 1,
  domain_cited: true,
  cited_urls: ['https://acme.com'],
  competitor_mentions: [{ name: 'Rival', mentioned: true, cited: false }],
  insight: 'Your brand is well-positioned. Keep producing comparison content.',
  cost_cents: 5,
  queried_at: '2026-04-10T12:00:00Z',
}

describe('ResearchResultCard', () => {
  test('renders platform name', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText('ChatGPT')).toBeDefined()
  })

  test('shows mentioned badge when brand is mentioned', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText('Mentioned')).toBeDefined()
  })

  test('shows not mentioned badge when brand is absent', () => {
    render(
      <ResearchResultCard result={{ ...baseResult, brand_mentioned: false, brand_position: null }} />
    )
    expect(screen.getByText('Not mentioned')).toBeDefined()
  })

  test('shows insight section when insight is present', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText(/well-positioned/)).toBeDefined()
  })

  test('hides insight section when insight is null', () => {
    render(<ResearchResultCard result={{ ...baseResult, insight: null }} />)
    expect(screen.queryByTestId('research-insight')).toBeNull()
  })

  test('shows sentiment badge', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText('Positive')).toBeDefined()
  })

  test('shows save to monitoring button', () => {
    render(<ResearchResultCard result={baseResult} onSaveToMonitoring={() => {}} />)
    expect(screen.getByText('Save to monitoring')).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/components/ai-visibility/research-result-card.test.tsx`

Expected: FAIL.

**Step 3: Create the result card component**

Create `components/ai-visibility/research-result-card.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { ResearchResult } from '@/lib/ai-visibility/research'

const PLATFORM_LABELS: Record<string, string> = {
  [AIPlatform.ChatGPT]: 'ChatGPT',
  [AIPlatform.Claude]: 'Claude',
  [AIPlatform.Perplexity]: 'Perplexity',
}

const SENTIMENT_COLORS: Record<string, string> = {
  [BrandSentiment.Positive]: 'bg-green-100 text-green-800',
  [BrandSentiment.Neutral]: 'bg-gray-100 text-gray-800',
  [BrandSentiment.Negative]: 'bg-red-100 text-red-800',
}

interface ResearchResultCardProps {
  result: ResearchResult
  onSaveToMonitoring?: () => void
}

export function ResearchResultCard({ result, onSaveToMonitoring }: ResearchResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const truncatedResponse = result.response_text.slice(0, 200)
  const needsTruncation = result.response_text.length > 200

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3" data-testid="research-result-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500" />
          <span className="font-medium">{PLATFORM_LABELS[result.platform] ?? result.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          {result.brand_mentioned ? (
            <>
              <Badge variant="outline" className="text-xs">
                Mentioned
              </Badge>
              {result.brand_position && (
                <Badge variant="outline" className="text-xs">
                  #{result.brand_position}
                </Badge>
              )}
              <Badge
                className={`text-xs ${SENTIMENT_COLORS[result.brand_sentiment] ?? ''}`}
                variant="outline"
              >
                {result.brand_sentiment.charAt(0).toUpperCase() + result.brand_sentiment.slice(1)}
              </Badge>
              {result.domain_cited && (
                <Badge variant="outline" className="text-xs text-blue-700">
                  Cited
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not mentioned
            </Badge>
          )}
        </div>
      </div>

      {/* Response text */}
      <div className="text-sm text-muted-foreground">
        <p>{expanded ? result.response_text : truncatedResponse}</p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                Show full response <ChevronDown className="size-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Competitor mentions */}
      {result.competitor_mentions && result.competitor_mentions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.competitor_mentions
            .filter((c) => c.mentioned)
            .map((c) => (
              <Badge key={c.name} variant="secondary" className="text-xs">
                {c.name}
                {c.cited ? ' (cited)' : ''}
              </Badge>
            ))}
        </div>
      )}

      {/* Insight */}
      {result.insight && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1"
          data-testid="research-insight"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <Lightbulb className="size-3.5" />
            Insight
          </div>
          <p className="text-sm text-amber-900 whitespace-pre-line">{result.insight}</p>
        </div>
      )}

      {/* Save to monitoring */}
      {onSaveToMonitoring && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onSaveToMonitoring}>
            Save to monitoring
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/components/ai-visibility/research-result-card.test.tsx`

Expected: 7 tests PASS.

**Step 5: Commit**

```bash
git add components/ai-visibility/research-result-card.tsx tests/unit/components/ai-visibility/research-result-card.test.tsx
git commit -m "feat: add ResearchResultCard component with insight display"
```

---

## Task 8: Research Result List Component

**Files:**

- Create: `components/ai-visibility/research-result-list.tsx`

**Step 1: Create the result list component**

Create `components/ai-visibility/research-result-list.tsx`:

```typescript
'use client'

import { AIPlatform } from '@/lib/enums'
import { ResearchResultCard } from './research-result-card'
import type { ResearchResult } from '@/lib/ai-visibility/research'

const PLATFORM_LABELS: Record<string, string> = {
  [AIPlatform.ChatGPT]: 'ChatGPT',
  [AIPlatform.Claude]: 'Claude',
  [AIPlatform.Perplexity]: 'Perplexity',
}

interface ResearchResultListProps {
  results: ResearchResult[]
  expectedPlatforms: AIPlatform[]
  onSaveToMonitoring?: (promptText: string) => void
  timedOut?: boolean
}

export function ResearchResultList({
  results,
  expectedPlatforms,
  onSaveToMonitoring,
  timedOut,
}: ResearchResultListProps) {
  const arrivedPlatforms = new Set(results.map((r) => r.platform))
  const pendingPlatforms = expectedPlatforms.filter((p) => !arrivedPlatforms.has(p))

  return (
    <div className="space-y-3">
      {/* Arrived results */}
      {results.map((result) => (
        <ResearchResultCard
          key={result.id}
          result={result}
          onSaveToMonitoring={onSaveToMonitoring ? () => onSaveToMonitoring(result.response_text) : undefined}
        />
      ))}

      {/* Pending platforms (skeleton cards) */}
      {pendingPlatforms.map((platform) => (
        <div
          key={platform}
          className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4"
          data-testid={`research-pending-${platform}`}
        >
          <div className="size-2 animate-pulse rounded-full bg-gray-400" />
          <span className="text-sm text-muted-foreground">
            {timedOut
              ? `${PLATFORM_LABELS[platform] ?? platform} — timed out`
              : `${PLATFORM_LABELS[platform] ?? platform} — loading...`}
          </span>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Run build to verify it compiles**

Run: `npm run build`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/ai-visibility/research-result-list.tsx
git commit -m "feat: add ResearchResultList with progressive loading states"
```

---

## Task 9: Research Section Component

**Files:**

- Create: `components/ai-visibility/research-section.tsx`
- Create: `tests/unit/components/ai-visibility/research-section.test.tsx`

**Step 1: Write research section tests**

Create `tests/unit/components/ai-visibility/research-section.test.tsx`:

```typescript
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResearchSection } from '@/components/ai-visibility/research-section'
import { AIPlatform } from '@/lib/enums'

// Mock the polling hook
vi.mock('@/hooks/use-polling', () => ({
  usePolling: vi.fn(() => ({ data: null, isLoading: false })),
}))

// Mock the add prompt dialog
vi.mock('@/components/ai-visibility/add-prompt-dialog', () => ({
  AddPromptDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

describe('ResearchSection', () => {
  test('renders input and run button', () => {
    render(
      <ResearchSection
        orgId="org-1"
        orgName="Acme"
        websiteUrl="https://acme.com"
        competitors={[]}
        existingTopics={[]}
        monthlySpendCents={500}
        monthlyBudgetCents={10000}
      />
    )

    expect(screen.getByPlaceholderText(/type a prompt/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /run/i })).toBeDefined()
  })

  test('shows budget info', () => {
    render(
      <ResearchSection
        orgId="org-1"
        orgName="Acme"
        websiteUrl="https://acme.com"
        competitors={[]}
        existingTopics={[]}
        monthlySpendCents={5000}
        monthlyBudgetCents={10000}
      />
    )

    expect(screen.getByText(/\$50\.00/)).toBeDefined()
    expect(screen.getByText(/\$100\.00/)).toBeDefined()
  })

  test('disables run button when input is empty', () => {
    render(
      <ResearchSection
        orgId="org-1"
        orgName="Acme"
        websiteUrl="https://acme.com"
        competitors={[]}
        existingTopics={[]}
        monthlySpendCents={500}
        monthlyBudgetCents={10000}
      />
    )

    const button = screen.getByRole('button', { name: /run/i })
    expect(button).toHaveProperty('disabled', true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/components/ai-visibility/research-section.test.tsx`

Expected: FAIL.

**Step 3: Create the research section component**

Create `components/ai-visibility/research-section.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePolling } from '@/hooks/use-polling'
import { ResearchResultList } from './research-result-list'
import { AddPromptDialog } from './add-prompt-dialog'
import type { AIPlatform } from '@/lib/enums'
import type { ResearchResult } from '@/lib/ai-visibility/research'
import type { TopicWithPrompts } from '@/lib/ai-visibility/queries'

interface ResearchSectionProps {
  orgId: string
  orgName: string
  websiteUrl: string | null
  competitors: { name: string; domain: string }[]
  existingTopics: TopicWithPrompts[]
  monthlySpendCents: number
  monthlyBudgetCents: number
}

const POLLING_TIMEOUT_MS = 30_000

export function ResearchSection({
  orgId,
  orgName,
  websiteUrl,
  competitors,
  existingTopics,
  monthlySpendCents,
  monthlyBudgetCents,
}: ResearchSectionProps) {
  const [promptText, setPromptText] = useState('')
  const [researchId, setResearchId] = useState<string | null>(null)
  const [expectedPlatforms, setExpectedPlatforms] = useState<AIPlatform[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [budgetWarning, setBudgetWarning] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedPromptText, setSavedPromptText] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const fetchResults = useCallback(async (): Promise<ResearchResult[]> => {
    const response = await fetch(`/api/ai-visibility/research/${researchId}/results`)
    return response.json()
  }, [researchId])

  const { data: results, isLoading: isPolling } = usePolling<ResearchResult[]>({
    fetcher: fetchResults,
    enabled: !!researchId,
    intervalMs: 2000,
    isComplete: (data) => data.length >= expectedPlatforms.length,
    onComplete: () => setTimedOut(false),
  })

  // Timeout handling
  useState(() => {
    if (!researchId) return
    const timer = setTimeout(() => {
      if ((results?.length ?? 0) < expectedPlatforms.length) {
        setTimedOut(true)
      }
    }, POLLING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  })

  const startResearch = async (confirmed = false) => {
    if (!confirmed && budgetExceeded) {
      setShowConfirm(true)
      return
    }

    setShowConfirm(false)
    setIsStarting(true)
    setError(null)
    setTimedOut(false)

    try {
      const response = await fetch('/api/ai-visibility/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          promptText: promptText.trim(),
          websiteUrl,
          orgName,
          competitors,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to start research')
      }

      const data = await response.json()
      setResearchId(data.researchId)
      setExpectedPlatforms(data.platforms)
      setBudgetWarning(data.budgetWarning)
      setSavedPromptText(promptText.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsStarting(false)
    }
  }

  const budgetExceeded = monthlyBudgetCents > 0 && monthlySpendCents >= monthlyBudgetCents
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`

  const handleSaveToMonitoring = () => {
    setSaveDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Research a Prompt</h2>

      {/* Input bar */}
      <div className="flex gap-2">
        <Input
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Type a prompt to test across AI platforms..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && promptText.trim()) startResearch()
          }}
          className="flex-1"
        />
        <Button
          onClick={() => startResearch()}
          disabled={!promptText.trim() || isStarting}
          data-testid="research-run-button"
        >
          <Search className="mr-2 size-4" />
          {isStarting ? 'Starting...' : 'Run'}
        </Button>
      </div>

      {/* Budget info */}
      <p className="text-xs text-muted-foreground">
        Budget: {formatCents(monthlySpendCents)} / {formatCents(monthlyBudgetCents)} used this
        month
      </p>

      {/* Budget exceeded confirmation */}
      {showConfirm && (
        <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3">
          <AlertTriangle className="size-4 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            Budget exceeded ({formatCents(monthlySpendCents)} / {formatCents(monthlyBudgetCents)}).
            Run anyway?
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => startResearch(true)}>
              Run anyway
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {researchId && (
        <ResearchResultList
          results={results ?? []}
          expectedPlatforms={expectedPlatforms}
          onSaveToMonitoring={handleSaveToMonitoring}
          timedOut={timedOut}
        />
      )}

      {/* Save to monitoring dialog (reuses existing AddPromptDialog) */}
      {saveDialogOpen && savedPromptText && (
        <AddPromptDialog
          orgId={orgId}
          existingTopics={existingTopics}
          defaultPromptText={savedPromptText}
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
        />
      )}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/components/ai-visibility/research-section.test.tsx`

Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add components/ai-visibility/research-section.tsx tests/unit/components/ai-visibility/research-section.test.tsx
git commit -m "feat: add ResearchSection component with input, polling, and budget handling"
```

---

## Task 10: Update AddPromptDialog for Pre-fill Support

**Files:**

- Modify: `components/ai-visibility/add-prompt-dialog.tsx`

**Step 1: Read the current AddPromptDialog**

Read `components/ai-visibility/add-prompt-dialog.tsx` to understand the current implementation.

**Step 2: Add optional props for pre-fill and controlled open state**

Add these optional props to `AddPromptDialogProps`:

```typescript
interface AddPromptDialogProps {
  orgId: string
  existingTopics: TopicWithPrompts[]
  // New optional props for Research Mode "Save to monitoring"
  defaultPromptText?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}
```

When `defaultPromptText` is provided, initialize the prompt textarea with that value.

When `open` and `onOpenChange` are provided, use them for controlled dialog state instead of the internal `useState`. This lets the ResearchSection control when the dialog opens.

The dialog should use its internal open state by default (existing behavior), or the controlled props when provided.

**Step 3: Run lint and build**

Run: `npm run lint && npm run build`

Expected: Clean.

**Step 4: Commit**

```bash
git add components/ai-visibility/add-prompt-dialog.tsx
git commit -m "feat: add pre-fill and controlled open support to AddPromptDialog"
```

---

## Task 11: Wire Research Section into Prompts Page

**Files:**

- Modify: `app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/actions.ts`

**Step 1: Add server action for fetching research page data**

In `app/(authenticated)/[orgId]/ai-visibility/actions.ts`, add a new action to get the config data needed by the research section:

```typescript
export async function getResearchPageData(orgId: string) {
  const supabase = createServiceClient()

  const [configResult, orgResult] = await Promise.all([
    supabase.from('ai_visibility_configs').select('*').eq('organization_id', orgId).maybeSingle(),
    supabase.from('organizations').select('name, website_url').eq('id', orgId).single(),
  ])

  const config = configResult.data
  const org = orgResult.data

  if (!config || !org) return null

  const { getCurrentMonthSpend } = await import('@/lib/ai-visibility/budget')
  const monthlySpendCents = await getCurrentMonthSpend(orgId)

  return {
    orgName: org.name,
    websiteUrl: org.website_url,
    competitors: config.competitors as { name: string; domain: string }[],
    monthlySpendCents,
    monthlyBudgetCents: config.monthly_budget_cents,
    isActive: config.is_active,
  }
}
```

**Step 2: Update the Prompts page to include Research Section**

Modify `app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ai-visibility/page-header'
import { PromptAccordion } from '@/components/ai-visibility/prompt-accordion'
import { AddPromptDialog } from '@/components/ai-visibility/add-prompt-dialog'
import { ResearchSection } from '@/components/ai-visibility/research-section'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquareText } from 'lucide-react'
import { getTopicsWithPrompts } from '@/lib/ai-visibility/queries'
import { getResearchPageData } from '../actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function PromptsPage({ params }: PageProps) {
  const { orgId } = await params
  const supabase = await createClient()

  const [topics, researchData] = await Promise.all([
    getTopicsWithPrompts(supabase, orgId),
    getResearchPageData(orgId),
  ])

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="Prompts">
        <AddPromptDialog orgId={orgId} existingTopics={topics} />
      </PageHeader>

      {topics.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No prompts configured"
          description="Add prompts to track how AI platforms respond to queries about your brand."
        />
      ) : (
        <PromptAccordion topics={topics} />
      )}

      {/* Research Section */}
      {researchData && researchData.isActive && (
        <div className="border-t pt-6">
          <ResearchSection
            orgId={orgId}
            orgName={researchData.orgName}
            websiteUrl={researchData.websiteUrl}
            competitors={researchData.competitors}
            existingTopics={topics}
            monthlySpendCents={researchData.monthlySpendCents}
            monthlyBudgetCents={researchData.monthlyBudgetCents}
          />
        </div>
      )}
    </div>
  )
}
```

**Step 3: Run lint and build**

Run: `npm run lint && npm run build`

Expected: Clean.

**Step 4: Commit**

```bash
git add app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx app/(authenticated)/[orgId]/ai-visibility/actions.ts
git commit -m "feat: wire Research Section into Prompts page"
```

---

## Task 12: Save to Monitoring — Link Results to Prompt

**Files:**

- Modify: `app/(authenticated)/[orgId]/ai-visibility/actions.ts`

**Step 1: Add action to link research results to a prompt**

In `app/(authenticated)/[orgId]/ai-visibility/actions.ts`, add:

```typescript
export async function linkResearchResultsToPrompt(
  orgId: string,
  researchId: string,
  promptId: string
) {
  return withAdminAuth(async () => {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('ai_visibility_results')
      .update({ prompt_id: promptId })
      .eq('research_id', researchId)
      .eq('organization_id', orgId)

    if (error) {
      return { success: false as const, error: 'Failed to link results' }
    }

    revalidatePath(`/${orgId}/ai-visibility/prompts`)
    return { success: true as const }
  })
}
```

**Step 2: Update ResearchSection to call link action after save**

In `components/ai-visibility/research-section.tsx`, after the AddPromptDialog saves successfully, call `linkResearchResultsToPrompt(orgId, researchId, newPromptId)` to retroactively link the stored results.

This requires the AddPromptDialog to return the created prompt ID on success. Update the `addPrompt` action in `app/(authenticated)/[orgId]/ai-visibility/actions.ts` to return `{ success: true, promptId: string }` instead of just `{ success: true }`.

**Step 3: Run lint and build**

Run: `npm run lint && npm run build`

**Step 4: Commit**

```bash
git add app/(authenticated)/[orgId]/ai-visibility/actions.ts components/ai-visibility/research-section.tsx
git commit -m "feat: link research results to prompt on save to monitoring"
```

---

## Task 13: Final Verification

**Step 1: Run lint**

Run: `npm run lint`

Expected: 0 errors.

**Step 2: Run all unit tests**

Run: `npm run test:unit`

Expected: All pass.

**Step 3: Run build**

Run: `npm run build`

Expected: Succeeds.

**Step 4: Commit any fixes and push**

```bash
git push
```
