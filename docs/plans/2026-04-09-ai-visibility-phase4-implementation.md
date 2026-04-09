# AI Visibility Phase 4 — Dashboard & UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the four UI surfaces for AI Visibility: Overview dashboard, Prompts management page, Brand Mentions log, and config section in org settings.

**Architecture:** Server components fetch data and pass to client sub-components. Shared components (PageHeader, badges, chips, SyncButton) ensure consistent look across all AI Visibility pages. Data queries live in `lib/ai-visibility/queries.ts` with pure transformation helpers that are independently testable.

**Tech Stack:** Next.js RSC + client components, Shadcn UI (Card, Badge, Select, Dialog, Switch, Collapsible), Recharts (via MetricCard), existing ScoreRing and ScoreTrendChart components, server actions with `withAdminAuth`.

**Depends on:** Phase 3 complete (sync orchestrator, budget system, cron job, `runAIVisibilitySync` server action in `app/(authenticated)/[orgId]/ai-visibility/actions.ts`).

---

### Task 1: Shared AI Visibility components

**Files:**

- Create: `components/ai-visibility/page-header.tsx`
- Create: `components/ai-visibility/badges.tsx`

These shared components ensure consistent layout and styling across all AI Visibility pages.

**Step 1: Create the PageHeader and SyncButton components**

Create `components/ai-visibility/page-header.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { runAIVisibilitySync } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

interface SyncButtonProps {
  orgId: string
  lastSyncAt?: string | null
}

export function SyncButton({ orgId, lastSyncAt }: SyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [lastSync, setLastSync] = useState(lastSyncAt)

  const handleSync = () => {
    startTransition(async () => {
      const result = await runAIVisibilitySync(orgId)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      if (result.success) {
        toast.success(
          `Sync complete: ${result.queriesCompleted} queries run` +
            (result.budgetExceeded ? ' (budget limit reached)' : '')
        )
        setLastSync(new Date().toISOString())
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      {lastSync && (
        <span className="text-muted-foreground text-xs">
          Last synced{' '}
          {new Date(lastSync).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      )}
      <Button onClick={handleSync} disabled={isPending} variant="outline" size="sm">
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Sync Now
      </Button>
    </div>
  )
}
```

**Step 2: Create the shared badge and chip components**

Create `components/ai-visibility/badges.tsx`:

```typescript
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES, SENTIMENT_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import { cn } from '@/lib/utils'

// =============================================================================
// Platform Badge
// =============================================================================

const PLATFORM_COLORS: Record<AIPlatform, string> = {
  [AIPlatform.ChatGPT]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [AIPlatform.Claude]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  [AIPlatform.Perplexity]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

export function PlatformBadge({ platform }: { platform: AIPlatform }) {
  return (
    <Badge variant="secondary" className={PLATFORM_COLORS[platform]}>
      {PLATFORM_DISPLAY_NAMES[platform]}
    </Badge>
  )
}

// =============================================================================
// Sentiment Badge
// =============================================================================

const SENTIMENT_COLORS: Record<BrandSentiment, string> = {
  [BrandSentiment.Positive]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [BrandSentiment.Neutral]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  [BrandSentiment.Negative]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function SentimentBadge({ sentiment }: { sentiment: BrandSentiment }) {
  return (
    <Badge variant="secondary" className={SENTIMENT_COLORS[sentiment]}>
      {SENTIMENT_DISPLAY_NAMES[sentiment]}
    </Badge>
  )
}

// =============================================================================
// Status Chip (Mentioned ✓, Cited ✗, etc.)
// =============================================================================

interface StatusChipProps {
  positive: boolean
  label: string
}

export function StatusChip({ positive, label }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        positive
          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      )}
    >
      {positive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  )
}

// =============================================================================
// Position Badge (1st third, 2nd third, 3rd third)
// =============================================================================

const POSITION_LABELS: Record<number, string> = {
  1: '1st third',
  2: '2nd third',
  3: '3rd third',
}

export function PositionBadge({ position }: { position: number | null }) {
  if (!position) return null
  return (
    <span className="text-muted-foreground text-xs">
      Pos: {POSITION_LABELS[position] ?? `${position}`}
    </span>
  )
}

// =============================================================================
// Competitor Pills
// =============================================================================

interface CompetitorMention {
  name: string
  mentioned: boolean
  cited: boolean
}

export function CompetitorPills({ competitors }: { competitors: CompetitorMention[] }) {
  if (!competitors?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {competitors.map((c) => (
        <span
          key={c.name}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
            c.mentioned
              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
              : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
          )}
        >
          {c.name}
          {c.mentioned ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
      ))}
    </div>
  )
}
```

**Step 3: Verify no lint errors**

Run: `npx eslint components/ai-visibility/page-header.tsx components/ai-visibility/badges.tsx --no-error-on-unmatched-pattern`
Expected: No errors

**Step 4: Format and commit**

```bash
npx prettier --write components/ai-visibility/page-header.tsx components/ai-visibility/badges.tsx
git add components/ai-visibility/page-header.tsx components/ai-visibility/badges.tsx
git commit -m "feat: add shared AI Visibility UI components (PageHeader, badges, chips)"
```

---

### Task 2: Data fetching queries

**Files:**

- Create: `lib/ai-visibility/queries.ts`
- Create: `tests/unit/lib/ai-visibility/queries.test.ts`

Server-side query functions and pure data transformation helpers.

**Step 1: Write tests for pure transformation helpers**

Create `tests/unit/lib/ai-visibility/queries.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/ai-visibility/queries.test.ts`
Expected: FAIL — `groupResultsByPromptId` and `assembleTopicsWithPrompts` not found

**Step 3: Create the queries module**

Create `lib/ai-visibility/queries.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AIVisibilityScore,
  AIVisibilityConfig,
  AIVisibilityTopic,
  AIVisibilityPrompt,
  AIVisibilityResult,
} from './types'

// =============================================================================
// Exported Types
// =============================================================================

export interface PromptWithResults extends AIVisibilityPrompt {
  results: AIVisibilityResult[]
}

export interface TopicWithPrompts extends AIVisibilityTopic {
  prompts: PromptWithResults[]
}

export interface MentionFilters {
  platform?: string
  sentiment?: string
  days?: number
}

export interface MentionResult extends AIVisibilityResult {
  prompt_text: string
}

// =============================================================================
// Pure Transformation Helpers (exported for testing)
// =============================================================================

export function groupResultsByPromptId(
  results: AIVisibilityResult[]
): Map<string, AIVisibilityResult[]> {
  const map = new Map<string, AIVisibilityResult[]>()
  for (const result of results) {
    if (!map.has(result.prompt_id)) map.set(result.prompt_id, [])
    map.get(result.prompt_id)!.push(result)
  }
  return map
}

export function assembleTopicsWithPrompts(
  topics: AIVisibilityTopic[],
  prompts: AIVisibilityPrompt[],
  resultsByPrompt: Map<string, AIVisibilityResult[]>
): TopicWithPrompts[] {
  return topics.map((topic) => ({
    ...topic,
    prompts: prompts
      .filter((p) => p.topic_id === topic.id)
      .map((prompt) => ({
        ...prompt,
        results: resultsByPrompt.get(prompt.id) ?? [],
      })),
  }))
}

// =============================================================================
// Server-Side Query Functions
// =============================================================================

export async function getLatestScores(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ latest: AIVisibilityScore | null; previous: AIVisibilityScore | null }> {
  const { data } = await supabase
    .from('ai_visibility_scores')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(2)

  return {
    latest: data?.[0] ?? null,
    previous: data?.[1] ?? null,
  }
}

export async function getScoreHistory(
  supabase: SupabaseClient,
  orgId: string,
  limit = 10
): Promise<{ score: number; created_at: string }[]> {
  const { data } = await supabase
    .from('ai_visibility_scores')
    .select('score, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(limit)

  return data ?? []
}

export async function getAIVisibilityConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<AIVisibilityConfig | null> {
  const { data } = await supabase
    .from('ai_visibility_configs')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  return data
}

export async function getTopicsWithPrompts(
  supabase: SupabaseClient,
  orgId: string
): Promise<TopicWithPrompts[]> {
  const { data: topics } = await supabase
    .from('ai_visibility_topics')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')

  if (!topics?.length) return []

  const { data: prompts } = await supabase
    .from('ai_visibility_prompts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at')

  if (!prompts?.length) return topics.map((t) => ({ ...t, prompts: [] }))

  // Get results from the most recent sync only
  const { data: latestResult } = await supabase
    .from('ai_visibility_results')
    .select('queried_at')
    .eq('organization_id', orgId)
    .order('queried_at', { ascending: false })
    .limit(1)

  let resultsByPrompt = new Map<string, AIVisibilityResult[]>()

  if (latestResult?.length) {
    const { data: results } = await supabase
      .from('ai_visibility_results')
      .select('*')
      .eq('organization_id', orgId)
      .eq('queried_at', latestResult[0].queried_at)

    resultsByPrompt = groupResultsByPromptId(results ?? [])
  }

  return assembleTopicsWithPrompts(topics, prompts, resultsByPrompt)
}

export async function getMentions(
  supabase: SupabaseClient,
  orgId: string,
  filters: MentionFilters = {}
): Promise<MentionResult[]> {
  let query = supabase
    .from('ai_visibility_results')
    .select('*, ai_visibility_prompts!inner(prompt_text)')
    .eq('organization_id', orgId)
    .eq('brand_mentioned', true)
    .order('queried_at', { ascending: false })
    .limit(100)

  if (filters.platform) {
    query = query.eq('platform', filters.platform)
  }
  if (filters.sentiment) {
    query = query.eq('brand_sentiment', filters.sentiment)
  }
  if (filters.days) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filters.days)
    query = query.gte('queried_at', cutoff.toISOString())
  }

  const { data } = await query

  return (data ?? []).map((row) => ({
    ...row,
    prompt_text: (row.ai_visibility_prompts as unknown as { prompt_text: string }).prompt_text,
  }))
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/queries.test.ts`
Expected: ALL PASS (4 tests)

**Step 5: Format and commit**

```bash
npx prettier --write lib/ai-visibility/queries.ts tests/unit/lib/ai-visibility/queries.test.ts
git add lib/ai-visibility/queries.ts tests/unit/lib/ai-visibility/queries.test.ts
git commit -m "feat: add AI Visibility data queries with transformation helpers"
```

---

### Task 3: Overview page

**Files:**

- Create: `components/ai-visibility/overview-dashboard.tsx`
- Create: `components/ai-visibility/platform-breakdown.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/page.tsx`

**Step 1: Create the PlatformBreakdown component**

Create `components/ai-visibility/platform-breakdown.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AIPlatform } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import type { PlatformBreakdown as PlatformBreakdownType } from '@/lib/ai-visibility/types'

interface PlatformBreakdownProps {
  breakdown: PlatformBreakdownType | null
}

const PLATFORM_BAR_COLORS: Record<string, string> = {
  [AIPlatform.ChatGPT]: 'bg-green-500',
  [AIPlatform.Claude]: 'bg-orange-500',
  [AIPlatform.Perplexity]: 'bg-blue-500',
}

export function PlatformBreakdown({ breakdown }: PlatformBreakdownProps) {
  if (!breakdown) return null

  const platforms = Object.entries(breakdown)
  if (platforms.length === 0) return null

  const maxMentions = Math.max(...platforms.map(([, v]) => v.mentions), 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Platform Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {platforms.map(([platform, stats]) => (
          <div key={platform} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {PLATFORM_DISPLAY_NAMES[platform as AIPlatform] ?? platform}
              </span>
              <span className="text-muted-foreground">
                {stats.mentions} mentions · {stats.citations} citations
              </span>
            </div>
            <div className="bg-muted h-2 rounded-full">
              <div
                className={`h-2 rounded-full ${PLATFORM_BAR_COLORS[platform] ?? 'bg-primary'}`}
                style={{ width: `${(stats.mentions / maxMentions) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create the OverviewDashboard client component**

Create `components/ai-visibility/overview-dashboard.tsx`:

```typescript
'use client'

import { ScoreRing } from '@/components/reports/score-ring'
import { ScoreTrendChart, type ScoreDataPoint } from '@/components/audit/score-trend-chart'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SyncButton } from '@/components/ai-visibility/page-header'
import { PlatformBreakdown } from '@/components/ai-visibility/platform-breakdown'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScoreStatus } from '@/lib/enums'
import { getScoreStatus } from '@/lib/reports/types'
import type { AIVisibilityScore, AIVisibilityConfig } from '@/lib/ai-visibility/types'
import type { TimeSeriesDataPoint } from '@/lib/metrics/types'

const SCORE_STATUS_LABELS: Record<ScoreStatus, string> = {
  [ScoreStatus.Good]: 'Good',
  [ScoreStatus.NeedsImprovement]: 'Needs Improvement',
  [ScoreStatus.Poor]: 'Poor',
}

interface OverviewDashboardProps {
  orgId: string
  latestScore: AIVisibilityScore | null
  previousScore: AIVisibilityScore | null
  scoreHistory: { score: number; created_at: string }[]
  config: AIVisibilityConfig | null
}

export function OverviewDashboard({
  orgId,
  latestScore,
  previousScore,
  scoreHistory,
  config,
}: OverviewDashboardProps) {
  const hasData = latestScore !== null

  // Map score history for ScoreTrendChart
  const trendDataPoints: ScoreDataPoint[] = scoreHistory.map((s) => ({
    score: s.score,
    completedAt: s.created_at,
  }))

  // Map score history for MetricCard sparklines
  const mentionsTimeSeries: TimeSeriesDataPoint[] = scoreHistory.map((s) => ({
    date: s.created_at.split('T')[0],
    value: s.mentions_count ?? 0,
  }))

  const citationsTimeSeries: TimeSeriesDataPoint[] = scoreHistory.map((s) => ({
    date: s.created_at.split('T')[0],
    value: s.citations_count ?? 0,
  }))

  const citedPagesTimeSeries: TimeSeriesDataPoint[] = scoreHistory.map((s) => ({
    date: s.created_at.split('T')[0],
    value: s.cited_pages_count ?? 0,
  }))

  // Score delta
  const scoreDelta =
    latestScore && previousScore ? latestScore.score - previousScore.score : null

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="AI Visibility">
        <SyncButton orgId={orgId} lastSyncAt={config?.last_sync_at} />
      </PageHeader>

      {!hasData ? (
        <EmptyState
          icon={Eye}
          title="No visibility data yet"
          description="Run your first sync to start tracking how your brand appears in AI responses."
        />
      ) : (
        <>
          {/* Hero: Score Ring + Trend Chart */}
          <Card>
            <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2">
                <ScoreRing
                  score={latestScore.score}
                  size="xl"
                  showLabel
                  label="AI Visibility"
                />
                <span className="text-muted-foreground text-sm font-medium">
                  {SCORE_STATUS_LABELS[getScoreStatus(latestScore.score)]}
                  {scoreDelta !== null && scoreDelta !== 0 && (
                    <span
                      className={`ml-2 ${scoreDelta > 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {scoreDelta > 0 ? '+' : ''}
                      {scoreDelta} from last
                    </span>
                  )}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground mb-2 text-sm font-medium">Score Trend</p>
                <ScoreTrendChart dataPoints={trendDataPoints} />
              </div>
            </CardContent>
          </Card>

          {/* Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Mentions"
              value={latestScore.mentions_count}
              change={null}
              tooltip="Number of times your brand was mentioned across AI platforms"
              timeSeries={mentionsTimeSeries}
            />
            <MetricCard
              label="Citations"
              value={latestScore.citations_count}
              change={null}
              tooltip="Number of times your domain was cited in AI responses"
              timeSeries={citationsTimeSeries}
            />
            <MetricCard
              label="Cited Pages"
              value={latestScore.cited_pages_count}
              change={null}
              tooltip="Unique pages from your domain cited by AI platforms"
              timeSeries={citedPagesTimeSeries}
            />
          </div>

          {/* Platform Breakdown */}
          <PlatformBreakdown breakdown={latestScore.platform_breakdown} />
        </>
      )}
    </div>
  )
}
```

**Step 3: Update the Overview page to fetch data and render the dashboard**

Replace `app/(authenticated)/[orgId]/ai-visibility/page.tsx` with:

```typescript
import { createClient } from '@/lib/supabase/server'
import { OverviewDashboard } from '@/components/ai-visibility/overview-dashboard'
import {
  getLatestScores,
  getScoreHistory,
  getAIVisibilityConfig,
} from '@/lib/ai-visibility/queries'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AIVisibilityPage({ params }: PageProps) {
  const { orgId } = await params
  const supabase = await createClient()

  const [scores, history, config] = await Promise.all([
    getLatestScores(supabase, orgId),
    getScoreHistory(supabase, orgId),
    getAIVisibilityConfig(supabase, orgId),
  ])

  return (
    <OverviewDashboard
      orgId={orgId}
      latestScore={scores.latest}
      previousScore={scores.previous}
      scoreHistory={history}
      config={config}
    />
  )
}
```

**Step 4: Verify lint passes**

Run: `npx eslint components/ai-visibility/overview-dashboard.tsx components/ai-visibility/platform-breakdown.tsx app/\(authenticated\)/\[orgId\]/ai-visibility/page.tsx --no-error-on-unmatched-pattern`
Expected: No errors (warnings are OK)

**Step 5: Format and commit**

```bash
npx prettier --write components/ai-visibility/overview-dashboard.tsx components/ai-visibility/platform-breakdown.tsx "app/(authenticated)/[orgId]/ai-visibility/page.tsx"
git add components/ai-visibility/overview-dashboard.tsx components/ai-visibility/platform-breakdown.tsx "app/(authenticated)/[orgId]/ai-visibility/page.tsx"
git commit -m "feat: add AI Visibility overview dashboard with score ring, metrics, and platform breakdown"
```

---

### Task 4: Prompts page

**Files:**

- Create: `components/ai-visibility/prompt-accordion.tsx`
- Create: `components/ai-visibility/add-prompt-dialog.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/actions.ts` (add `addPrompt` action)

**Step 1: Create the PromptAccordion component**

This handles the topic accordion + prompt table + expandable per-platform results.

Create `components/ai-visibility/prompt-accordion.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'
import { BrandSentiment, AIPlatform } from '@/lib/enums'
import type { TopicWithPrompts, PromptWithResults } from '@/lib/ai-visibility/queries'
import type { AIVisibilityResult } from '@/lib/ai-visibility/types'

interface PromptAccordionProps {
  topics: TopicWithPrompts[]
}

export function PromptAccordion({ topics }: PromptAccordionProps) {
  return (
    <div className="space-y-3">
      {topics.map((topic, index) => (
        <TopicSection key={topic.id} topic={topic} defaultOpen={index === 0} />
      ))}
    </div>
  )
}

function TopicSection({
  topic,
  defaultOpen,
}: {
  topic: TopicWithPrompts
  defaultOpen: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]_&]:-rotate-90" />
            <span className="font-medium">{topic.name}</span>
            <Badge variant="secondary" className="text-xs">
              {topic.prompts.length} prompt{topic.prompts.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-3 pb-3">
            {topic.prompts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No prompts in this topic yet.</p>
            ) : (
              <div className="space-y-1">
                {topic.prompts.map((prompt) => (
                  <PromptRow key={prompt.id} prompt={prompt} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function PromptRow({ prompt }: { prompt: PromptWithResults }) {
  const [expanded, setExpanded] = useState(false)
  const mentionedCount = prompt.results.filter((r) => r.brand_mentioned).length
  const totalPlatforms = prompt.results.length
  const sentiments = prompt.results
    .filter((r) => r.brand_mentioned)
    .map((r) => r.brand_sentiment as BrandSentiment)
  const dominantSentiment = sentiments.length > 0 ? getDominantSentiment(sentiments) : null

  return (
    <div className="rounded-md border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 p-3 text-left text-sm hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1 truncate">{prompt.prompt_text}</span>
        <div className="flex shrink-0 items-center gap-3">
          {totalPlatforms > 0 && (
            <>
              <span className="text-muted-foreground text-xs">
                {mentionedCount}/{totalPlatforms} mentioned
              </span>
              {dominantSentiment && <SentimentBadge sentiment={dominantSentiment} />}
            </>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>
      {expanded && prompt.results.length > 0 && (
        <div className="border-t bg-muted/20 p-3">
          <div className="space-y-3">
            {prompt.results.map((result) => (
              <ResultDetail key={result.id} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultDetail({ result }: { result: AIVisibilityResult }) {
  return (
    <div className="space-y-2 rounded-md bg-background p-3">
      <div className="flex items-center gap-2">
        <PlatformBadge platform={result.platform as AIPlatform} />
        {result.brand_mentioned && (
          <SentimentBadge sentiment={result.brand_sentiment as BrandSentiment} />
        )}
        <PositionBadge position={result.brand_position} />
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusChip positive={result.brand_mentioned} label="Mentioned" />
        <StatusChip positive={result.domain_cited} label="Cited" />
      </div>
      {result.competitor_mentions && (
        <CompetitorPills competitors={result.competitor_mentions} />
      )}
      <p className="text-muted-foreground line-clamp-3 text-xs">{result.response_text}</p>
    </div>
  )
}

function getDominantSentiment(sentiments: BrandSentiment[]): BrandSentiment {
  const counts = sentiments.reduce(
    (acc, s) => {
      acc[s] = (acc[s] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as BrandSentiment
}
```

**Step 2: Create the AddPromptDialog component**

Create `components/ai-visibility/add-prompt-dialog.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addPrompt } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'
import type { AIVisibilityTopic } from '@/lib/ai-visibility/types'

interface AddPromptDialogProps {
  orgId: string
  existingTopics: AIVisibilityTopic[]
}

const NEW_TOPIC_VALUE = '__new__'

export function AddPromptDialog({ orgId, existingTopics }: AddPromptDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [newTopicName, setNewTopicName] = useState('')
  const [promptText, setPromptText] = useState('')

  const isNewTopic = selectedTopicId === NEW_TOPIC_VALUE

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const topicName = isNewTopic ? newTopicName.trim() : undefined
    const topicId = isNewTopic ? undefined : selectedTopicId

    if (isNewTopic && !topicName) {
      toast.error('Please enter a topic name')
      return
    }
    if (!promptText.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    startTransition(async () => {
      const result = await addPrompt(orgId, {
        topicName: topicName ?? '',
        topicId,
        promptText: promptText.trim(),
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      if (result.success) {
        toast.success('Prompt added')
        setOpen(false)
        setSelectedTopicId('')
        setNewTopicName('')
        setPromptText('')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Prompt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Prompt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic..." />
              </SelectTrigger>
              <SelectContent>
                {existingTopics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_TOPIC_VALUE}>+ Create new topic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNewTopic && (
            <div className="space-y-2">
              <Label htmlFor="topicName">Topic Name</Label>
              <Input
                id="topicName"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g., Prescription Glasses"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., What are the best online retailers for prescription glasses?"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Adding...' : 'Add Prompt'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 3: Add the `addPrompt` server action**

Modify `app/(authenticated)/[orgId]/ai-visibility/actions.ts`. Add to the existing file (which already has `runAIVisibilitySync`):

Add these imports at the top:

```typescript
import { PromptSource } from '@/lib/enums'
```

Add this function after the existing `runAIVisibilitySync`:

```typescript
export async function addPrompt(
  orgId: string,
  data: { topicName: string; topicId?: string; promptText: string }
) {
  return withAdminAuth(async () => {
    const supabase = createServiceClient()

    let topicId = data.topicId

    if (!topicId) {
      if (!data.topicName.trim()) {
        return { success: false as const, error: 'Topic name is required' }
      }

      const { data: topic, error } = await supabase
        .from('ai_visibility_topics')
        .insert({
          organization_id: orgId,
          name: data.topicName.trim(),
          source: PromptSource.Manual,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        return { success: false as const, error: 'Failed to create topic' }
      }
      topicId = topic.id
    }

    const { error } = await supabase.from('ai_visibility_prompts').insert({
      topic_id: topicId,
      organization_id: orgId,
      prompt_text: data.promptText.trim(),
      source: PromptSource.Manual,
      is_active: true,
    })

    if (error) {
      return { success: false as const, error: 'Failed to create prompt' }
    }

    revalidatePath(`/${orgId}/ai-visibility/prompts`)
    return { success: true as const }
  })
}
```

**Step 4: Update the Prompts page**

Replace `app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx` with:

```typescript
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ai-visibility/page-header'
import { PromptAccordion } from '@/components/ai-visibility/prompt-accordion'
import { AddPromptDialog } from '@/components/ai-visibility/add-prompt-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquareText } from 'lucide-react'
import { getTopicsWithPrompts } from '@/lib/ai-visibility/queries'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function PromptsPage({ params }: PageProps) {
  const { orgId } = await params
  const supabase = await createClient()
  const topics = await getTopicsWithPrompts(supabase, orgId)

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
    </div>
  )
}
```

**Step 5: Verify lint passes**

Run: `npx eslint components/ai-visibility/prompt-accordion.tsx components/ai-visibility/add-prompt-dialog.tsx "app/(authenticated)/[orgId]/ai-visibility/actions.ts" "app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx" --no-error-on-unmatched-pattern`
Expected: No errors

**Step 6: Format and commit**

```bash
npx prettier --write components/ai-visibility/prompt-accordion.tsx components/ai-visibility/add-prompt-dialog.tsx "app/(authenticated)/[orgId]/ai-visibility/actions.ts" "app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx"
git add components/ai-visibility/prompt-accordion.tsx components/ai-visibility/add-prompt-dialog.tsx "app/(authenticated)/[orgId]/ai-visibility/actions.ts" "app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx"
git commit -m "feat: add AI Visibility prompts page with topic accordions and add prompt dialog"
```

---

### Task 5: Brand Mentions page

**Files:**

- Create: `components/ai-visibility/mention-card.tsx`
- Create: `components/ai-visibility/mention-filters.tsx`
- Create: `components/ai-visibility/mentions-list.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx`

**Step 1: Create the MentionFilters component**

Create `components/ai-visibility/mention-filters.tsx`:

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES, SENTIMENT_DISPLAY_NAMES } from '@/lib/ai-visibility/types'

const ALL_VALUE = '__all__'

export function MentionFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPlatform = searchParams.get('platform') ?? ALL_VALUE
  const currentSentiment = searchParams.get('sentiment') ?? ALL_VALUE
  const currentDays = searchParams.get('days') ?? '30'

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === ALL_VALUE) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={currentPlatform} onValueChange={(v) => updateFilter('platform', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Platforms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Platforms</SelectItem>
          {Object.values(AIPlatform).map((platform) => (
            <SelectItem key={platform} value={platform}>
              {PLATFORM_DISPLAY_NAMES[platform]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSentiment} onValueChange={(v) => updateFilter('sentiment', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Sentiment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Sentiment</SelectItem>
          {Object.values(BrandSentiment).map((sentiment) => (
            <SelectItem key={sentiment} value={sentiment}>
              {SENTIMENT_DISPLAY_NAMES[sentiment]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentDays} onValueChange={(v) => updateFilter('days', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

**Step 2: Create the MentionCard component**

Create `components/ai-visibility/mention-card.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { MentionResult } from '@/lib/ai-visibility/queries'

interface MentionCardProps {
  mention: MentionResult
}

export function MentionCard({ mention }: MentionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const snippet = mention.response_text.slice(0, 200)
  const hasMore = mention.response_text.length > 200

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Header: prompt text */}
        <p className="truncate text-sm font-medium">{mention.prompt_text}</p>

        {/* Meta: platform + sentiment + date */}
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={mention.platform as AIPlatform} />
          <SentimentBadge sentiment={mention.brand_sentiment as BrandSentiment} />
          <span className="text-muted-foreground text-xs">
            {new Date(mention.queried_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Response snippet */}
        <div className="text-muted-foreground text-sm">
          <p>{expanded ? mention.response_text : snippet}{!expanded && hasMore && '...'}</p>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary mt-1 text-xs font-medium hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Footer: status chips + competitor pills */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip positive={mention.brand_mentioned} label="Mentioned" />
          <StatusChip positive={mention.domain_cited} label="Cited" />
          <PositionBadge position={mention.brand_position} />
        </div>
        {mention.competitor_mentions && (
          <CompetitorPills competitors={mention.competitor_mentions} />
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 3: Create the MentionsList wrapper**

Create `components/ai-visibility/mentions-list.tsx`:

```typescript
import { MentionCard } from '@/components/ai-visibility/mention-card'
import { EmptyState } from '@/components/ui/empty-state'
import { AtSign, SearchX } from 'lucide-react'
import type { MentionResult } from '@/lib/ai-visibility/queries'

interface MentionsListProps {
  mentions: MentionResult[]
  hasFilters: boolean
}

export function MentionsList({ mentions, hasFilters }: MentionsListProps) {
  if (mentions.length === 0) {
    return hasFilters ? (
      <EmptyState
        icon={SearchX}
        title="No mentions match your filters"
        description="Try adjusting the platform, sentiment, or date range filters."
      />
    ) : (
      <EmptyState
        icon={AtSign}
        title="No mentions yet"
        description="Run a sync to start tracking how AI platforms mention your brand."
      />
    )
  }

  return (
    <div className="space-y-3">
      {mentions.map((mention) => (
        <MentionCard key={mention.id} mention={mention} />
      ))}
    </div>
  )
}
```

**Step 4: Update the Mentions page**

Replace `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx` with:

```typescript
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ai-visibility/page-header'
import { MentionFilters } from '@/components/ai-visibility/mention-filters'
import { MentionsList } from '@/components/ai-visibility/mentions-list'
import { getMentions } from '@/lib/ai-visibility/queries'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ platform?: string; sentiment?: string; days?: string }>
}

export default async function MentionsPage({ params, searchParams }: PageProps) {
  const { orgId } = await params
  const filters = await searchParams
  const supabase = await createClient()

  const mentions = await getMentions(supabase, orgId, {
    platform: filters.platform,
    sentiment: filters.sentiment,
    days: filters.days ? parseInt(filters.days, 10) : 30,
  })

  const hasFilters = !!(filters.platform || filters.sentiment)

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="Brand Mentions" />

      <Suspense>
        <MentionFilters />
      </Suspense>

      <MentionsList mentions={mentions} hasFilters={hasFilters} />
    </div>
  )
}
```

**Step 5: Verify lint passes**

Run: `npx eslint components/ai-visibility/mention-card.tsx components/ai-visibility/mention-filters.tsx components/ai-visibility/mentions-list.tsx "app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx" --no-error-on-unmatched-pattern`
Expected: No errors

**Step 6: Format and commit**

```bash
npx prettier --write components/ai-visibility/mention-card.tsx components/ai-visibility/mention-filters.tsx components/ai-visibility/mentions-list.tsx "app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx"
git add components/ai-visibility/mention-card.tsx components/ai-visibility/mention-filters.tsx components/ai-visibility/mentions-list.tsx "app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx"
git commit -m "feat: add AI Visibility brand mentions page with filters and mention cards"
```

---

### Task 6: Config form in org settings

**Files:**

- Create: `components/ai-visibility/config-form.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/actions.ts` (add `updateAIVisibilityConfig`)
- Modify: `app/(authenticated)/[orgId]/settings/organization/page.tsx`

**Step 1: Add `updateAIVisibilityConfig` server action**

Modify `app/(authenticated)/[orgId]/ai-visibility/actions.ts`. Add this import at the top:

```typescript
import { AIPlatform, SyncFrequency } from '@/lib/enums'
```

Add this function after the existing actions:

```typescript
export async function updateAIVisibilityConfig(
  orgId: string,
  data: {
    isActive: boolean
    platforms: AIPlatform[]
    syncFrequency: SyncFrequency
    monthlyBudgetCents: number
    budgetAlertThreshold: number
    competitors: { name: string; domain: string }[]
  }
) {
  return withAdminAuth(async () => {
    if (data.isActive && data.platforms.length === 0) {
      return { success: false as const, error: 'Select at least one platform when active' }
    }
    if (data.monthlyBudgetCents < 100) {
      return { success: false as const, error: 'Minimum budget is $1.00' }
    }
    if (data.budgetAlertThreshold < 50 || data.budgetAlertThreshold > 100) {
      return { success: false as const, error: 'Alert threshold must be between 50% and 100%' }
    }
    if (data.competitors.length > 10) {
      return { success: false as const, error: 'Maximum 10 competitors allowed' }
    }

    const supabase = createServiceClient()

    const { error } = await supabase.from('ai_visibility_configs').upsert(
      {
        organization_id: orgId,
        is_active: data.isActive,
        platforms: data.platforms,
        sync_frequency: data.syncFrequency,
        monthly_budget_cents: data.monthlyBudgetCents,
        budget_alert_threshold: data.budgetAlertThreshold,
        competitors: data.competitors,
      },
      { onConflict: 'organization_id' }
    )

    if (error) {
      console.error('[AI Visibility Config]', {
        type: 'update_failed',
        organizationId: orgId,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      return { success: false as const, error: 'Failed to save configuration' }
    }

    revalidatePath(`/${orgId}/settings/organization`)
    revalidatePath(`/${orgId}/ai-visibility`)
    return { success: true as const }
  })
}
```

**Step 2: Create the ConfigForm component**

Create `components/ai-visibility/config-form.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateAIVisibilityConfig } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'
import { AIPlatform, SyncFrequency } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES, ALL_PLATFORMS } from '@/lib/ai-visibility/types'
import type { AIVisibilityConfig } from '@/lib/ai-visibility/types'

interface ConfigFormProps {
  orgId: string
  config: AIVisibilityConfig | null
}

const FREQUENCY_LABELS: Record<SyncFrequency, string> = {
  [SyncFrequency.Daily]: 'Daily',
  [SyncFrequency.Weekly]: 'Weekly',
  [SyncFrequency.Monthly]: 'Monthly',
}

export function AIVisibilityConfigForm({ orgId, config }: ConfigFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(config?.is_active ?? false)
  const [platforms, setPlatforms] = useState<AIPlatform[]>(config?.platforms ?? ALL_PLATFORMS)
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>(
    (config?.sync_frequency as SyncFrequency) ?? SyncFrequency.Daily
  )
  const [budgetDollars, setBudgetDollars] = useState(
    ((config?.monthly_budget_cents ?? 10000) / 100).toString()
  )
  const [alertThreshold, setAlertThreshold] = useState(
    (config?.budget_alert_threshold ?? 90).toString()
  )
  const [competitors, setCompetitors] = useState<{ name: string; domain: string }[]>(
    config?.competitors ?? []
  )

  const togglePlatform = (platform: AIPlatform) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  const addCompetitor = () => {
    if (competitors.length >= 10) return
    setCompetitors([...competitors, { name: '', domain: '' }])
  }

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index: number, field: 'name' | 'domain', value: string) => {
    const updated = [...competitors]
    updated[index] = { ...updated[index], [field]: value }
    setCompetitors(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateAIVisibilityConfig(orgId, {
        isActive,
        platforms,
        syncFrequency,
        monthlyBudgetCents: Math.round(parseFloat(budgetDollars || '0') * 100),
        budgetAlertThreshold: parseInt(alertThreshold || '90', 10),
        competitors: competitors.filter((c) => c.name.trim()),
      })

      if ('error' in result) {
        toast.error(result.error)
      } else if (result.success) {
        toast.success('AI Visibility configuration saved')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Visibility</CardTitle>
        <CardDescription>
          Configure how Selo tracks your brand across AI platforms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable AI Visibility</Label>
              <p className="text-muted-foreground text-sm">
                Automatically sync brand mentions from AI platforms
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-4">
              {ALL_PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <Checkbox
                    checked={platforms.includes(platform)}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <span className="text-sm">{PLATFORM_DISPLAY_NAMES[platform]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label>Sync Frequency</Label>
            <Select
              value={syncFrequency}
              onValueChange={(v) => setSyncFrequency(v as SyncFrequency)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SyncFrequency).map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {FREQUENCY_LABELS[freq]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monthly Budget</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={budgetDollars}
                  onChange={(e) => setBudgetDollars(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alert Threshold</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="pr-8"
                />
                <span className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Competitors */}
          <div className="space-y-3">
            <Label>Competitors</Label>
            {competitors.map((competitor, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Name"
                  value={competitor.name}
                  onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="domain.com"
                  value={competitor.domain}
                  onChange={(e) => updateCompetitor(index, 'domain', e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCompetitor(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {competitors.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
                <Plus className="mr-2 h-4 w-4" />
                Add Competitor
              </Button>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Add the config form to org settings page**

Modify `app/(authenticated)/[orgId]/settings/organization/page.tsx`.

Add import at top:

```typescript
import { AIVisibilityConfigForm } from '@/components/ai-visibility/config-form'
import { getAIVisibilityConfig } from '@/lib/ai-visibility/queries'
```

Inside the `withSettingsAuth` callback, after the existing queries, add:

```typescript
const aiVisConfig = await getAIVisibilityConfig(supabase, organizationId)
```

Update the return statement to include `aiVisConfig`:

```typescript
return { org, auditCount: auditCount || 0, industries: industries || [], aiVisConfig }
```

Update the destructuring:

```typescript
const { org, auditCount, industries, aiVisConfig } = result.data
```

Add the config form after `<OrganizationForm>` in the JSX:

```tsx
<AIVisibilityConfigForm orgId={org.id} config={aiVisConfig} />
```

**Step 4: Verify lint passes**

Run: `npx eslint components/ai-visibility/config-form.tsx "app/(authenticated)/[orgId]/ai-visibility/actions.ts" "app/(authenticated)/[orgId]/settings/organization/page.tsx" --no-error-on-unmatched-pattern`
Expected: No errors

**Step 5: Format and commit**

```bash
npx prettier --write components/ai-visibility/config-form.tsx "app/(authenticated)/[orgId]/ai-visibility/actions.ts" "app/(authenticated)/[orgId]/settings/organization/page.tsx"
git add components/ai-visibility/config-form.tsx "app/(authenticated)/[orgId]/ai-visibility/actions.ts" "app/(authenticated)/[orgId]/settings/organization/page.tsx"
git commit -m "feat: add AI Visibility config form in org settings"
```

---

### Task 7: Final verification

**Step 1: Run full lint + test + build**

Run: `npm run lint && npx vitest run tests/unit/lib/ai-visibility/ && npm run build`
Expected: ALL PASS

**Step 2: Verify new file structure**

Run: `find components/ai-visibility -type f | sort`

Expected:

```
components/ai-visibility/add-prompt-dialog.tsx
components/ai-visibility/badges.tsx
components/ai-visibility/config-form.tsx
components/ai-visibility/mention-card.tsx
components/ai-visibility/mention-filters.tsx
components/ai-visibility/mentions-list.tsx
components/ai-visibility/overview-dashboard.tsx
components/ai-visibility/page-header.tsx
components/ai-visibility/platform-breakdown.tsx
components/ai-visibility/prompt-accordion.tsx
```

**Step 3: Verify all AI visibility tests pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/`

Expected: 84+ tests passing (80 from Phase 2-3 + 4 new query tests)

**Step 4: Push**

```bash
git push
```
