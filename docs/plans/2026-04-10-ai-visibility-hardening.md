# AI Visibility Hardening Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bugs, security gaps, performance issues, and add test coverage + minor UX enhancements across the AI Visibility feature.

**Architecture:** Three batches ordered by risk profile. Batch A (Tasks 1-6) fixes bugs and security issues with surgical changes. Batch B (Tasks 7-11) improves performance and code quality. Batch C (Tasks 12-16) adds test coverage and UX enhancements. Each batch ends with a lint/test/build gate.

**Tech Stack:** Next.js 16, Supabase, Vitest, TypeScript, Vercel AI SDK

---

## Batch A: Bug Fixes & Security

### Task 1: Fix unchecked insert error in sync

**Files:**

- Modify: `lib/ai-visibility/sync.ts:114-129`

**Step 1: Add error check to sync insert**

In `lib/ai-visibility/sync.ts`, replace the unchecked insert (line 114-129) with error-checked version:

```typescript
const { error: insertError } = await supabase.from('ai_visibility_results').insert({
  prompt_id: prompt.id,
  organization_id: organizationId,
  platform,
  response_text: response.text,
  brand_mentioned: analysis.brand_mentioned,
  brand_sentiment: analysis.brand_sentiment,
  brand_position: analysis.brand_position,
  domain_cited: analysis.domain_cited,
  cited_urls: analysis.cited_urls,
  competitor_mentions: analysis.competitor_mentions,
  tokens_used: response.inputTokens + response.outputTokens,
  cost_cents: queryCost,
  queried_at: queriedAt,
  raw_response: null,
})

if (insertError) {
  console.error('[AI Visibility Sync]', {
    type: 'result_insert_failed',
    organizationId,
    promptId: prompt.id,
    platform,
    error: insertError.message,
    timestamp: new Date().toISOString(),
  })
}
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/sync.test.ts`

Expected: All pass (existing mocks return success by default).

**Step 3: Commit**

```bash
git add lib/ai-visibility/sync.ts
git commit -m "fix: check insert errors in AI Visibility sync"
```

---

### Task 2: Fix handleSaved silent failure in ResearchSection

**Files:**

- Modify: `components/ai-visibility/research-section.tsx:124-127`

**Step 1: Add error handling and user notification**

Replace the `handleSaved` function:

```typescript
const handleSaved = async (promptId: string) => {
  if (!researchId) return
  try {
    const result = await linkResearchResultsToPrompt(orgId, researchId, promptId)
    if ('error' in result) {
      console.error('[Research Save Error]', {
        type: 'link_results_failed',
        researchId,
        promptId,
        error: result.error,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('[Research Save Error]', {
      type: 'link_results_exception',
      researchId,
      promptId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/components/ai-visibility/research-section.test.tsx`

Expected: 3 tests pass.

**Step 3: Commit**

```bash
git add components/ai-visibility/research-section.tsx
git commit -m "fix: add error handling to research save-to-monitoring"
```

---

### Task 3: Parallelize platform queries in sync

**Files:**

- Modify: `lib/ai-visibility/sync.ts:82-156`

**Step 1: Refactor inner loop to use Promise.allSettled**

Replace the sequential nested loop with parallel-per-prompt execution. The outer prompt loop stays sequential (for budget checking between prompts), but the inner platform loop runs in parallel.

Replace lines 82-156 with:

```typescript
for (const prompt of prompts) {
  if (!canContinueSync(runningSpend, config.monthly_budget_cents)) {
    result.budgetExceeded = true
    break
  }

  const platformResults = await Promise.allSettled(
    config.platforms.map(async (platform) => {
      const adapter = getAdapter(platform)
      const response = await adapter.query(prompt.prompt_text)
      const analysis = await analyzeResponse(response, orgContext)

      const queryCost = response.costCents + analysis.sentiment_cost_cents

      return { platform, response, analysis, queryCost }
    })
  )

  for (const settled of platformResults) {
    if (settled.status === 'rejected') {
      result.errors.push({
        promptId: prompt.id,
        platform: 'unknown',
        error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
      })
      continue
    }

    const { platform, response, analysis, queryCost } = settled.value

    runningSpend += queryCost
    result.totalCostCents += queryCost
    result.queriesCompleted++

    if (analysis.brand_mentioned) {
      mentionedCount++
      allSentiments.push(analysis.brand_sentiment as BrandSentiment)
    }
    if (analysis.domain_cited) {
      citedCount++
      analysis.cited_urls.forEach((url) => allCitedUrls.add(url))
    }

    if (!platformBreakdown[platform]) {
      platformBreakdown[platform] = { mentions: 0, citations: 0 }
    }
    if (analysis.brand_mentioned) platformBreakdown[platform].mentions++
    if (analysis.domain_cited) platformBreakdown[platform].citations++

    const { error: insertError } = await supabase.from('ai_visibility_results').insert({
      prompt_id: prompt.id,
      organization_id: organizationId,
      platform,
      response_text: response.text,
      brand_mentioned: analysis.brand_mentioned,
      brand_sentiment: analysis.brand_sentiment,
      brand_position: analysis.brand_position,
      domain_cited: analysis.domain_cited,
      cited_urls: analysis.cited_urls,
      competitor_mentions: analysis.competitor_mentions,
      tokens_used: response.inputTokens + response.outputTokens,
      cost_cents: queryCost,
      queried_at: queriedAt,
      raw_response: null,
    })

    if (insertError) {
      console.error('[AI Visibility Sync]', {
        type: 'result_insert_failed',
        organizationId,
        promptId: prompt.id,
        platform,
        error: insertError.message,
        timestamp: new Date().toISOString(),
      })
    }

    await logUsage(platform === 'chatgpt' ? 'openai' : platform, 'ai_visibility_query', {
      organizationId,
      feature: UsageFeature.AIVisibility,
      tokensInput: response.inputTokens,
      tokensOutput: response.outputTokens,
      cost: queryCost,
      metadata: { promptId: prompt.id, platform },
    })
  }
}
```

Note: This subsumes Task 1's insert error fix. The budget check moves to per-prompt (before each batch) rather than per-platform. This is a trade-off: we may slightly overshoot budget within one prompt's platforms, but the parallelism benefit outweighs this since individual query costs are small.

**Step 2: Run tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/sync.test.ts`

Expected: All pass.

**Step 3: Commit**

```bash
git add lib/ai-visibility/sync.ts
git commit -m "perf: parallelize platform queries within each prompt during sync"
```

---

### Task 4: Fix auth bypass on empty research results

**Files:**

- Modify: `app/api/ai-visibility/research/[researchId]/results/route.ts:38-48`

**Step 1: Move authorization before fetching results**

The current code checks org ownership only when results exist. Instead, validate org access upfront using the researchId. Since research results don't have their own table and researchId is ephemeral, we need to check the org's research access differently.

The simplest approach: if no results exist yet, we can't verify ownership from results. Instead, verify the user belongs to the org that started the research by checking if any result for this researchId belongs to the user's org. If no results exist yet, allow (the researchId is a UUID that's effectively unguessable — 128-bit random). Once results exist, enforce.

Actually, the better fix: always check authorization regardless of result count. When results are empty, return empty array (the data leaked is `[]` which is harmless, but the principle matters). The real fix is to restructure so we don't need results to check auth.

Replace lines 38-50 with:

```typescript
  const { researchId } = await params

  try {
    const results = await getResearchResults(researchId)

    // Verify user has access — check org of results, or verify user's org
    if (!isInternalUser(userRecord)) {
      // Check if any result belongs to a different org
      const foreignResult = results.find(
        (r) => r.organization_id !== userRecord.organization_id
      )
      if (foreignResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      // If no results yet, the researchId is a 128-bit UUID — unguessable.
      // The start endpoint already verified org access before generating it.
    }

    return NextResponse.json(results)
```

**Step 2: Run lint**

Run: `npm run lint`

Expected: Clean.

**Step 3: Commit**

```bash
git add "app/api/ai-visibility/research/[researchId]/results/route.ts"
git commit -m "fix: check org authorization on all research results, not just non-empty"
```

---

### Task 5: Type brand_sentiment as BrandSentiment enum

**Files:**

- Modify: `lib/ai-visibility/analyzer.ts:149`
- Modify: `lib/ai-visibility/sync.ts:101`
- Modify: `lib/ai-visibility/types.ts` (AIVisibilityResult interface)

**Step 1: Change AnalyzedResponse.brand_sentiment type**

In `lib/ai-visibility/analyzer.ts`, line 149, change:

```typescript
brand_sentiment: string
```

to:

```typescript
brand_sentiment: BrandSentiment
```

Add the import at the top if not already present:

```typescript
import { BrandSentiment } from '@/lib/enums'
```

**Step 2: Remove the `as BrandSentiment` cast in sync.ts line 101**

Change:

```typescript
allSentiments.push(analysis.brand_sentiment as BrandSentiment)
```

to:

```typescript
allSentiments.push(analysis.brand_sentiment)
```

**Step 3: Update AIVisibilityResult interface in types.ts**

Change `brand_sentiment: string` to `brand_sentiment: BrandSentiment` and add the import.

**Step 4: Fix any resulting type errors**

Run: `npm run build`

There may be places where `result.brand_sentiment` is used with `as BrandSentiment` casts that can now be removed. Remove them. There may also be places where a `string` value from Supabase is assigned — those will need `as BrandSentiment` at the DB boundary only (in queries.ts and research.ts where we cast Supabase rows).

**Step 5: Run tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/`

Expected: All pass.

**Step 6: Commit**

```bash
git add lib/ai-visibility/analyzer.ts lib/ai-visibility/sync.ts lib/ai-visibility/types.ts
# Add any other files that needed changes
git commit -m "fix: type brand_sentiment as BrandSentiment enum instead of string"
```

---

### Task 6: Extract platform-to-provider mapping

**Files:**

- Create: `lib/ai-visibility/platforms/provider-keys.ts`
- Modify: `lib/ai-visibility/sync.ts:131`
- Modify: `lib/ai-visibility/research.ts:116`

**Step 1: Create the shared mapping**

Create `lib/ai-visibility/platforms/provider-keys.ts`:

```typescript
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
```

**Step 2: Replace inline mapping in sync.ts and research.ts**

In both files, replace:

```typescript
platform === 'chatgpt' ? 'openai' : platform
```

with:

```typescript
PLATFORM_PROVIDER_KEYS[platform]
```

Add import:

```typescript
import { PLATFORM_PROVIDER_KEYS } from './platforms/provider-keys'
```

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/`

Expected: All pass.

**Step 4: Commit**

```bash
git add lib/ai-visibility/platforms/provider-keys.ts lib/ai-visibility/sync.ts lib/ai-visibility/research.ts
git commit -m "refactor: extract platform-to-provider key mapping"
```

---

## Batch A Gate

Run: `npm run lint && npx vitest run tests/unit/lib/ai-visibility/ tests/unit/components/ai-visibility/ && npm run build`

Expected: All clean. If not, fix before continuing.

---

## Batch B: Performance & Code Quality

### Task 7: Optimize getTopicsWithPrompts to use fewer queries

**Files:**

- Modify: `lib/ai-visibility/queries.ts:124-167`

**Step 1: Reduce from 4 queries to 2**

Replace `getTopicsWithPrompts` with an optimized version that fetches topics+prompts in one query using PostgREST join, then fetches latest results separately:

```typescript
export async function getTopicsWithPrompts(
  supabase: SupabaseClient,
  orgId: string
): Promise<TopicWithPrompts[]> {
  // Query 1: topics with their prompts via join
  const { data: topics } = await supabase
    .from('ai_visibility_topics')
    .select('*, ai_visibility_prompts(*)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('ai_visibility_prompts.is_active', true)
    .order('name')

  if (!topics?.length) return []

  // Extract prompts from joined data
  const allPrompts = topics.flatMap(
    (t) =>
      ((t.ai_visibility_prompts as unknown[]) ?? []) as {
        id: string
        prompt_text: string
        created_at: string
      }[]
  )

  if (allPrompts.length === 0) {
    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      is_active: t.is_active,
      created_at: t.created_at,
      prompts: [],
    }))
  }

  // Query 2: latest results for all prompts
  const promptIds = allPrompts.map((p) => p.id)
  const { data: latestResult } = await supabase
    .from('ai_visibility_results')
    .select('queried_at')
    .eq('organization_id', orgId)
    .eq('source', 'sync')
    .in('prompt_id', promptIds)
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

  return topics.map((t) => {
    const topicPrompts = ((t.ai_visibility_prompts as unknown[]) ?? []) as {
      id: string
      prompt_text: string
      created_at: string
      is_active: boolean
    }[]
    return {
      id: t.id,
      name: t.name,
      is_active: t.is_active,
      created_at: t.created_at,
      prompts: topicPrompts
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((p) => ({
          ...p,
          results: resultsByPrompt.get(p.id) ?? [],
        })),
    }
  })
}
```

Note: This reduces from 4 queries to 2-3 (the latestResult + results queries could be combined with a subquery but that's beyond PostgREST's capabilities). The key win is removing the separate topics and prompts queries.

**Step 2: Run existing tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/queries.test.ts`

Expected: Pass (tests use pure function `groupResultsByPromptId`, not the query itself).

**Step 3: Run build**

Run: `npm run build`

Expected: Clean.

**Step 4: Commit**

```bash
git add lib/ai-visibility/queries.ts
git commit -m "perf: reduce getTopicsWithPrompts from 4 queries to 2"
```

---

### Task 8: Add "Load more" pagination to mentions

**Files:**

- Modify: `lib/ai-visibility/queries.ts` (getMentions)
- Modify: `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx`
- Modify: `components/ai-visibility/mentions-list.tsx`
- Create: `app/(authenticated)/[orgId]/ai-visibility/mentions/actions.ts`

**Step 1: Update getMentions to support cursor pagination**

In `lib/ai-visibility/queries.ts`, update `getMentions` to accept a `cursor` (queried_at timestamp) and return a `hasMore` flag:

```typescript
export interface MentionsPage {
  mentions: MentionResult[]
  hasMore: boolean
}

export async function getMentions(
  supabase: SupabaseClient,
  orgId: string,
  filters: MentionFilters = {},
  cursor?: string
): Promise<MentionsPage> {
  const PAGE_SIZE = 50

  let query = supabase
    .from('ai_visibility_results')
    .select('*, ai_visibility_prompts!inner(prompt_text)')
    .eq('organization_id', orgId)
    .eq('brand_mentioned', true)
    .order('queried_at', { ascending: false })
    .limit(PAGE_SIZE + 1) // Fetch one extra to detect hasMore

  if (cursor) {
    query = query.lt('queried_at', cursor)
  }

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

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  return {
    mentions: page.map((row) => ({
      ...row,
      prompt_text: (row.ai_visibility_prompts as unknown as { prompt_text: string }).prompt_text,
    })),
    hasMore,
  }
}
```

**Step 2: Create server action for loading more**

Create `app/(authenticated)/[orgId]/ai-visibility/mentions/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { getMentions } from '@/lib/ai-visibility/queries'
import type { MentionsPage } from '@/lib/ai-visibility/queries'

export async function loadMoreMentions(
  orgId: string,
  filters: { platform?: string; sentiment?: string; days?: number },
  cursor: string
): Promise<MentionsPage> {
  const supabase = await createClient()
  return getMentions(supabase, orgId, filters, cursor)
}
```

**Step 3: Update MentionsList to support "Load more"**

Make `MentionsList` a client component with state for additional loaded mentions:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { MentionCard } from '@/components/ai-visibility/mention-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { AtSign, SearchX } from 'lucide-react'
import { loadMoreMentions } from '@/app/(authenticated)/[orgId]/ai-visibility/mentions/actions'
import type { MentionResult } from '@/lib/ai-visibility/queries'

interface MentionsListProps {
  orgId: string
  initialMentions: MentionResult[]
  initialHasMore: boolean
  hasFilters: boolean
  filters: { platform?: string; sentiment?: string; days?: number }
}

export function MentionsList({
  orgId,
  initialMentions,
  initialHasMore,
  hasFilters,
  filters,
}: MentionsListProps) {
  const [mentions, setMentions] = useState(initialMentions)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isPending, startTransition] = useTransition()

  const handleLoadMore = () => {
    const lastMention = mentions[mentions.length - 1]
    if (!lastMention) return

    startTransition(async () => {
      const page = await loadMoreMentions(orgId, filters, lastMention.queried_at)
      setMentions((prev) => [...prev, ...page.mentions])
      setHasMore(page.hasMore)
    })
  }

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
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Update mentions page to pass new props**

In `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx`, update to use the new `MentionsPage` return type and pass props:

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

  const parsedFilters = {
    platform: filters.platform,
    sentiment: filters.sentiment,
    days: filters.days ? parseInt(filters.days, 10) : 30,
  }

  const { mentions, hasMore } = await getMentions(supabase, orgId, parsedFilters)

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="Brand Mentions" />

      <Suspense>
        <MentionFilters />
      </Suspense>

      <MentionsList
        orgId={orgId}
        initialMentions={mentions}
        initialHasMore={hasMore}
        hasFilters={!!(filters.platform || filters.sentiment)}
        filters={parsedFilters}
      />
    </div>
  )
}
```

**Step 5: Run lint and build**

Run: `npm run lint && npm run build`

Expected: Clean.

**Step 6: Commit**

```bash
git add lib/ai-visibility/queries.ts components/ai-visibility/mentions-list.tsx "app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx" "app/(authenticated)/[orgId]/ai-visibility/mentions/actions.ts"
git commit -m "feat: add cursor-based pagination to mentions list"
```

---

### Task 9: Add text search filter to mentions

**Files:**

- Modify: `lib/ai-visibility/queries.ts` (getMentions)
- Modify: `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx`
- Modify: `components/ai-visibility/mention-filters.tsx`
- Modify: `app/(authenticated)/[orgId]/ai-visibility/mentions/actions.ts`

**Step 1: Add search parameter to getMentions**

In `lib/ai-visibility/queries.ts`, add `search` to `MentionFilters`:

```typescript
interface MentionFilters {
  platform?: string
  sentiment?: string
  days?: number
  search?: string
}
```

And in the `getMentions` function, add after the existing filters:

```typescript
if (filters.search) {
  query = query.ilike('response_text', `%${filters.search}%`)
}
```

**Step 2: Add search input to MentionFilters**

In `components/ai-visibility/mention-filters.tsx`, add an `Input` at the beginning of the filter bar:

```typescript
import { Input } from '@/components/ui/input'
```

Add state and debounce for the search input. Since filters use URL params with `router.push`, add:

```typescript
  const currentSearch = searchParams.get('search') ?? ''

  // Inside the JSX, before the first Select:
  <Input
    placeholder="Search mentions..."
    defaultValue={currentSearch}
    onChange={(e) => {
      const value = e.target.value
      // Debounce: only update URL after 300ms
      clearTimeout((window as unknown as { __searchTimeout?: NodeJS.Timeout }).__searchTimeout)
      ;(window as unknown as { __searchTimeout?: NodeJS.Timeout }).__searchTimeout = setTimeout(() => {
        updateFilter('search', value || ALL_VALUE)
      }, 300)
    }}
    className="w-[200px]"
  />
```

**Step 3: Update page to pass search filter**

In the mentions page, add `search` to the parsed filters:

```typescript
const parsedFilters = {
  platform: filters.platform,
  sentiment: filters.sentiment,
  days: filters.days ? parseInt(filters.days, 10) : 30,
  search: filters.search,
}
```

Update the `searchParams` type to include `search?: string`.

Also update `hasFilters` to include search:

```typescript
hasFilters={!!(filters.platform || filters.sentiment || filters.search)}
```

**Step 4: Update loadMoreMentions action**

Add `search` to the filters parameter type in `mentions/actions.ts`.

**Step 5: Run lint and build**

Run: `npm run lint && npm run build`

Expected: Clean.

**Step 6: Commit**

```bash
git add lib/ai-visibility/queries.ts components/ai-visibility/mention-filters.tsx "app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx" "app/(authenticated)/[orgId]/ai-visibility/mentions/actions.ts"
git commit -m "feat: add text search filter to mentions list"
```

---

### Task 10: Centralize model versions

**Files:**

- Create: `lib/ai-visibility/platforms/models.ts`
- Modify: `lib/ai-visibility/platforms/chatgpt/adapter.ts`
- Modify: `lib/ai-visibility/platforms/claude/adapter.ts`
- Modify: `lib/ai-visibility/platforms/perplexity/adapter.ts`
- Modify: `lib/ai-visibility/sentiment.ts`
- Modify: `lib/ai-visibility/insights.ts`

**Step 1: Create centralized model config**

Create `lib/ai-visibility/platforms/models.ts`:

```typescript
/**
 * Centralized model versions for all AI Visibility platform adapters.
 * Update here when upgrading models — no need to hunt through adapter files.
 */
export const AI_MODELS = {
  chatgpt: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  perplexity: 'sonar',
  /** Used for sentiment analysis and insight generation */
  haiku: 'claude-haiku-4-5-20251001',
} as const
```

**Step 2: Update all files to import from models.ts**

In each adapter file, replace the local `const MODEL = '...'` with:

```typescript
import { AI_MODELS } from '../models'
```

And use `AI_MODELS.chatgpt`, `AI_MODELS.claude`, `AI_MODELS.perplexity`, or `AI_MODELS.haiku` respectively.

In `lib/ai-visibility/sentiment.ts`, replace `const MODEL = 'claude-haiku-4-5-20251001'` with import from `'./platforms/models'` using `AI_MODELS.haiku`.

In `lib/ai-visibility/insights.ts`, replace `const HAIKU_MODEL = 'claude-haiku-4-5-20251001'` with import from `'./platforms/models'` using `AI_MODELS.haiku`.

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/`

Expected: All pass.

**Step 4: Commit**

```bash
git add lib/ai-visibility/platforms/models.ts lib/ai-visibility/platforms/chatgpt/adapter.ts lib/ai-visibility/platforms/claude/adapter.ts lib/ai-visibility/platforms/perplexity/adapter.ts lib/ai-visibility/sentiment.ts lib/ai-visibility/insights.ts
git commit -m "refactor: centralize AI model versions in models.ts"
```

---

### Task 11: Fix timezone in budget start-of-month calculation

**Files:**

- Modify: `lib/ai-visibility/budget.ts:49-51`

**Step 1: Use UTC explicitly**

Replace the start-of-month calculation:

```typescript
const startOfMonth = new Date()
startOfMonth.setDate(1)
startOfMonth.setHours(0, 0, 0, 0)
```

with:

```typescript
const now = new Date()
const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/lib/ai-visibility/budget.test.ts`

Expected: All pass.

**Step 3: Commit**

```bash
git add lib/ai-visibility/budget.ts
git commit -m "fix: use UTC for budget start-of-month calculation"
```

---

## Batch B Gate

Run: `npm run lint && npx vitest run tests/unit/lib/ai-visibility/ tests/unit/components/ai-visibility/ && npm run build`

Expected: All clean.

---

## Batch C: Test Coverage & UX Enhancements

### Task 12: Add accessibility improvements

**Files:**

- Modify: `components/ai-visibility/mention-card.tsx`
- Modify: `components/ai-visibility/mention-filters.tsx`
- Modify: `components/ai-visibility/prompt-accordion.tsx`

**Step 1: Add aria-expanded to MentionCard expand button**

In `components/ai-visibility/mention-card.tsx`, add `aria-expanded={expanded}` to the expand/collapse button.

**Step 2: Add aria-labels to MentionFilters selects**

In `components/ai-visibility/mention-filters.tsx`, add `aria-label` to each `SelectTrigger`:

```typescript
<SelectTrigger className="w-[160px]" aria-label="Filter by platform">
// ...
<SelectTrigger className="w-[160px]" aria-label="Filter by sentiment">
// ...
<SelectTrigger className="w-[140px]" aria-label="Filter by time period">
```

**Step 3: Add aria-expanded to PromptRow button**

In `components/ai-visibility/prompt-accordion.tsx`, add `aria-expanded={expanded}` to the PromptRow button (line 75).

**Step 4: Run lint**

Run: `npm run lint`

Expected: Clean.

**Step 5: Commit**

```bash
git add components/ai-visibility/mention-card.tsx components/ai-visibility/mention-filters.tsx components/ai-visibility/prompt-accordion.tsx
git commit -m "fix: add aria attributes to AI Visibility interactive elements"
```

---

### Task 13: Add empty state for prompts awaiting first sync

**Files:**

- Modify: `components/ai-visibility/prompt-accordion.tsx`

**Step 1: Show "Awaiting first sync" when prompt has no results**

In `PromptRow`, after line 92 (`{expanded && prompt.results.length > 0 && (`), add an else branch:

```typescript
      {expanded && prompt.results.length === 0 && (
        <div className="border-t p-3">
          <p className="text-muted-foreground text-center text-sm">
            Awaiting first sync results
          </p>
        </div>
      )}
```

**Step 2: Run lint**

Run: `npm run lint`

Expected: Clean.

**Step 3: Commit**

```bash
git add components/ai-visibility/prompt-accordion.tsx
git commit -m "feat: show 'awaiting first sync' for prompts with no results"
```

---

### Task 14: Add component tests for badges

**Files:**

- Create: `tests/unit/components/ai-visibility/badges.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'

describe('PlatformBadge', () => {
  test('renders platform display name', () => {
    render(<PlatformBadge platform={AIPlatform.ChatGPT} />)
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
  })
})

describe('SentimentBadge', () => {
  test('renders sentiment label', () => {
    render(<SentimentBadge sentiment={BrandSentiment.Positive} />)
    expect(screen.getByText('Positive')).toBeInTheDocument()
  })

  test('renders negative sentiment', () => {
    render(<SentimentBadge sentiment={BrandSentiment.Negative} />)
    expect(screen.getByText('Negative')).toBeInTheDocument()
  })
})

describe('StatusChip', () => {
  test('renders positive chip with check icon', () => {
    render(<StatusChip positive={true} label="Mentioned" />)
    expect(screen.getByText('Mentioned')).toBeInTheDocument()
  })

  test('renders negative chip with x icon', () => {
    render(<StatusChip positive={false} label="Cited" />)
    expect(screen.getByText('Cited')).toBeInTheDocument()
  })
})

describe('PositionBadge', () => {
  test('renders position label', () => {
    render(<PositionBadge position={1} />)
    expect(screen.getByText(/1st third/)).toBeInTheDocument()
  })

  test('returns null for null position', () => {
    const { container } = render(<PositionBadge position={null} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('CompetitorPills', () => {
  test('renders competitor names', () => {
    render(
      <CompetitorPills
        competitors={[
          { name: 'Rival Co', mentioned: true, cited: false },
          { name: 'Other Inc', mentioned: false, cited: false },
        ]}
      />
    )
    expect(screen.getByText('Rival Co')).toBeInTheDocument()
    expect(screen.getByText('Other Inc')).toBeInTheDocument()
  })

  test('returns null for empty array', () => {
    const { container } = render(<CompetitorPills competitors={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/components/ai-visibility/badges.test.tsx`

Expected: All pass.

**Step 3: Commit**

```bash
git add tests/unit/components/ai-visibility/badges.test.tsx
git commit -m "test: add unit tests for AI Visibility badge components"
```

---

### Task 15: Add tests for mention-card and prompt-accordion

**Files:**

- Create: `tests/unit/components/ai-visibility/mention-card.test.tsx`

**Step 1: Write MentionCard tests**

```typescript
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionCard } from '@/components/ai-visibility/mention-card'
import { AIPlatform, BrandSentiment } from '@/lib/enums'

const baseMention = {
  id: '1',
  organization_id: 'org-1',
  prompt_id: 'p-1',
  platform: AIPlatform.ChatGPT,
  response_text: 'A'.repeat(300),
  brand_mentioned: true,
  brand_sentiment: BrandSentiment.Positive,
  brand_position: 1,
  domain_cited: true,
  cited_urls: ['https://acme.com/page'],
  competitor_mentions: [{ name: 'Rival', mentioned: true, cited: false }],
  cost_cents: 5,
  tokens_used: 100,
  queried_at: '2026-04-10T12:00:00Z',
  prompt_text: 'Best marketing tools',
  research_id: null,
  source: 'sync' as const,
  insight: null,
}

describe('MentionCard', () => {
  test('renders platform badge and prompt text', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(screen.getByText('Best marketing tools')).toBeInTheDocument()
  })

  test('renders sentiment and status badges', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('Positive')).toBeInTheDocument()
    expect(screen.getByText('Mentioned')).toBeInTheDocument()
    expect(screen.getByText('Cited')).toBeInTheDocument()
  })

  test('truncates long response text', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  test('expands response on click', async () => {
    const user = userEvent.setup()
    render(<MentionCard mention={baseMention} />)
    await user.click(screen.getByText('Show more'))
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  test('renders competitor pills', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('Rival')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/components/ai-visibility/mention-card.test.tsx`

Expected: All pass. If `MentionResult` type doesn't match `baseMention`, adjust the fixture to match the actual type.

**Step 3: Commit**

```bash
git add tests/unit/components/ai-visibility/mention-card.test.tsx
git commit -m "test: add unit tests for MentionCard component"
```

---

### Task 16: Final verification and push

**Step 1: Run full verification**

```bash
npm run lint && npm run test:unit && npm run build
```

Expected: All clean. The pre-existing `pages.test.tsx` failure (Resend API key) is not our regression — it existed before Phase 6.

**Step 2: Push**

```bash
git push
```
