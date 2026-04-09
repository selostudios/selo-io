# AI Visibility Phase 1 — Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lay the database, type system, cost tracking, and navigation foundation for the AI Visibility feature.

**Architecture:** Five new database tables with RLS, a `UsageFeature` enum added to the cost tracking system, navigation split from "SEO / AIO" into separate "SEO" and "AI Visibility" sections, and config/prompt management UI.

**Tech Stack:** Supabase PostgreSQL migrations, TypeScript enums, Vitest for TDD, Next.js App Router, Shadcn UI components.

## Progress

| Task | Status | Commit | Notes |
|------|--------|--------|-------|
| 1. UsageFeature enum + logUsage | Done | `3badf9f` | 6 unit tests pass |
| 2. Migration: usage_logs feature column | Done | `a83ac0d` | Backfill + index |
| 3. Migration: AI Visibility tables | Done | `b98e22b` | 5 tables, RLS policies |
| 4. Types and enums | Done | `e1d9f00` | 4 enums, 7 interfaces, 5 tests |
| 5. Navigation restructure | Done | `b1e5dec` | SEO / AI Visibility split, 7 tests |
| 6. Stub route pages | Done | `fa23938` | 3 pages + layout, 3 render tests |
| 7. Final verification | Done | — | 751 tests pass, build clean |
| 8. CLI command: sync:ai-visibility | Pending | — | Added to plan for Phase 2 |

**Completed:** 2026-04-09 | **Tests added:** 15 (751 total) | **Pushed to:** `origin/main`

---

### Task 1: Add `UsageFeature` enum and update `logUsage()`

This is the smallest, most self-contained change — add feature-level cost categorization.

**Files:**
- Modify: `lib/enums.ts`
- Modify: `lib/app-settings/usage.ts`
- Modify: `tests/unit/lib/app-settings/usage.test.ts`

**Step 1: Write the failing test**

Add a new test to `tests/unit/lib/app-settings/usage.test.ts`:

```typescript
it('includes feature field when provided', async () => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
  vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any)

  await logUsage('anthropic', 'ai_analysis', {
    organizationId: 'org-123',
    feature: 'site_audit',
  })

  expect(mockInsert).toHaveBeenCalledWith(
    expect.objectContaining({
      service: 'anthropic',
      event_type: 'ai_analysis',
      organization_id: 'org-123',
      feature: 'site_audit',
    })
  )
})

it('defaults feature to null when not provided', async () => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
  vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any)

  await logUsage('pagespeed', 'psi_fetch')

  expect(mockInsert).toHaveBeenCalledWith(
    expect.objectContaining({
      feature: null,
    })
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/app-settings/usage.test.ts -t "includes feature field"`
Expected: FAIL — `logUsage` doesn't accept or pass `feature`

**Step 3: Add the enum and update logUsage**

In `lib/enums.ts`, add at the end of the file (before the closing):

```typescript
// =============================================================================
// Usage Tracking Enums
// =============================================================================

export enum UsageFeature {
  SiteAudit = 'site_audit',
  ClientReports = 'client_reports',
  AIVisibility = 'ai_visibility',
}
```

In `lib/app-settings/usage.ts`, update the interface and function:

```typescript
interface UsageOptions {
  organizationId?: string | null
  feature?: string | null
  tokensInput?: number
  tokensOutput?: number
  cost?: number
  metadata?: Record<string, unknown>
}
```

And in the insert call, add the feature field:

```typescript
const { error } = await supabase.from('usage_logs').insert({
  service,
  event_type: eventType,
  organization_id: opts.organizationId ?? null,
  feature: opts.feature ?? null,
  tokens_input: opts.tokensInput ?? null,
  tokens_output: opts.tokensOutput ?? null,
  cost: opts.cost ?? null,
  metadata: opts.metadata ?? null,
})
```

**Step 4: Update existing test assertion**

The existing "uses null defaults when options are omitted" test needs updating — add `feature: null` to the expected call:

```typescript
expect(mockInsert).toHaveBeenCalledWith({
  service: 'pagespeed',
  event_type: 'psi_fetch',
  organization_id: null,
  feature: null,
  tokens_input: null,
  tokens_output: null,
  cost: null,
  metadata: null,
})
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/app-settings/usage.test.ts`
Expected: ALL PASS

**Step 6: Update existing call sites**

In `lib/unified-audit/ai-runner.ts`, find the `logUsage` call and add feature:
```typescript
await logUsage('anthropic', 'ai_analysis', {
  // ...existing fields...
  feature: UsageFeature.SiteAudit,
})
```

In `lib/unified-audit/psi-runner.ts`, find the `logUsage` call and add feature:
```typescript
await logUsage('pagespeed', 'psi_fetch', {
  // ...existing fields...
  feature: UsageFeature.SiteAudit,
})
```

In `lib/reports/summary-generator.ts`, find the `logUsage` call and add feature:
```typescript
await logUsage('anthropic', 'summary_generation', {
  // ...existing fields...
  feature: UsageFeature.ClientReports,
})
```

Import `UsageFeature` from `@/lib/enums` in each file.

**Step 7: Run full test suite to verify no regressions**

Run: `npx vitest run tests/unit`
Expected: ALL PASS

**Step 8: Commit**

```bash
git add lib/enums.ts lib/app-settings/usage.ts tests/unit/lib/app-settings/usage.test.ts \
  lib/unified-audit/ai-runner.ts lib/unified-audit/psi-runner.ts lib/reports/summary-generator.ts
git commit -m "feat: add UsageFeature enum and feature tracking to logUsage"
```

---

### Task 2: Database migration — `usage_logs` feature column

**Files:**
- Create: `supabase/migrations/20260409000000_add_usage_logs_feature_column.sql`

**Step 1: Write the migration**

```sql
-- Add feature column to usage_logs for product-area cost tracking
ALTER TABLE usage_logs ADD COLUMN feature TEXT;

-- Backfill existing rows based on event_type
UPDATE usage_logs SET feature = 'site_audit'
  WHERE event_type IN ('ai_analysis', 'psi_fetch');

UPDATE usage_logs SET feature = 'client_reports'
  WHERE event_type = 'summary_generation';

-- Index for feature-based cost queries
CREATE INDEX idx_usage_logs_feature_org
  ON usage_logs (feature, organization_id, created_at DESC);
```

**Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: All migrations apply successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260409000000_add_usage_logs_feature_column.sql
git commit -m "migration: add feature column to usage_logs with backfill"
```

---

### Task 3: Database migration — AI Visibility tables

**Files:**
- Create: `supabase/migrations/20260409000001_ai_visibility_tables.sql`

**Step 1: Write the migration**

```sql
-- ==========================================================================
-- AI Visibility Tables
-- ==========================================================================

-- 1. ai_visibility_configs — one per organization
CREATE TABLE ai_visibility_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  sync_frequency TEXT NOT NULL DEFAULT 'daily',
  platforms TEXT[] NOT NULL DEFAULT ARRAY['chatgpt', 'claude', 'perplexity'],
  is_active BOOLEAN NOT NULL DEFAULT false,
  monthly_budget_cents INTEGER NOT NULL DEFAULT 10000,
  budget_alert_threshold INTEGER NOT NULL DEFAULT 90,
  last_alert_sent_at TIMESTAMPTZ,
  last_alert_type TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_configs_select"
  ON ai_visibility_configs FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_configs_insert"
  ON ai_visibility_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) = 'admin'
  );

CREATE POLICY "ai_visibility_configs_update"
  ON ai_visibility_configs FOR UPDATE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin')
    OR (SELECT public.is_internal_user())
  );

GRANT SELECT, INSERT, UPDATE ON ai_visibility_configs TO authenticated;

-- 2. ai_visibility_topics
CREATE TABLE ai_visibility_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_topics_select"
  ON ai_visibility_topics FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_topics_insert"
  ON ai_visibility_topics FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

CREATE POLICY "ai_visibility_topics_update"
  ON ai_visibility_topics FOR UPDATE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_topics_delete"
  ON ai_visibility_topics FOR DELETE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE INDEX idx_ai_visibility_topics_org ON ai_visibility_topics (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_visibility_topics TO authenticated;

-- 3. ai_visibility_prompts
CREATE TABLE ai_visibility_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES ai_visibility_topics(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_prompts_select"
  ON ai_visibility_prompts FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_prompts_insert"
  ON ai_visibility_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

CREATE POLICY "ai_visibility_prompts_update"
  ON ai_visibility_prompts FOR UPDATE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_prompts_delete"
  ON ai_visibility_prompts FOR DELETE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE INDEX idx_ai_visibility_prompts_org ON ai_visibility_prompts (organization_id);
CREATE INDEX idx_ai_visibility_prompts_topic ON ai_visibility_prompts (topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_visibility_prompts TO authenticated;

-- 4. ai_visibility_results
CREATE TABLE ai_visibility_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES ai_visibility_prompts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  response_text TEXT NOT NULL,
  brand_mentioned BOOLEAN NOT NULL DEFAULT false,
  brand_sentiment TEXT NOT NULL DEFAULT 'neutral',
  brand_position INTEGER,
  domain_cited BOOLEAN NOT NULL DEFAULT false,
  cited_urls TEXT[],
  competitor_mentions JSONB,
  tokens_used INTEGER,
  cost_cents INTEGER,
  queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_results_select"
  ON ai_visibility_results FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

-- No INSERT/UPDATE/DELETE policies — service client writes bypass RLS

CREATE INDEX idx_ai_visibility_results_org_date
  ON ai_visibility_results (organization_id, queried_at DESC);
CREATE INDEX idx_ai_visibility_results_prompt
  ON ai_visibility_results (prompt_id, queried_at DESC);
CREATE INDEX idx_ai_visibility_results_platform
  ON ai_visibility_results (platform, queried_at DESC);

GRANT SELECT ON ai_visibility_results TO authenticated;

-- 5. ai_visibility_scores
CREATE TABLE ai_visibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  mentions_count INTEGER NOT NULL DEFAULT 0,
  citations_count INTEGER NOT NULL DEFAULT 0,
  cited_pages_count INTEGER NOT NULL DEFAULT 0,
  platform_breakdown JSONB,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_scores_select"
  ON ai_visibility_scores FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

-- No INSERT/UPDATE/DELETE policies — service client writes bypass RLS

CREATE INDEX idx_ai_visibility_scores_org_period
  ON ai_visibility_scores (organization_id, period_end DESC);

GRANT SELECT ON ai_visibility_scores TO authenticated;
```

**Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: All migrations apply successfully, no errors

**Step 3: Verify tables exist**

Run: `supabase db lint`
Expected: No warnings about the new tables

**Step 4: Commit**

```bash
git add supabase/migrations/20260409000001_ai_visibility_tables.sql
git commit -m "migration: add AI Visibility tables with RLS policies"
```

---

### Task 4: Core TypeScript types and enums

**Files:**
- Modify: `lib/enums.ts`
- Create: `lib/ai-visibility/types.ts`
- Test: `tests/unit/lib/ai-visibility/types.test.ts`

**Step 1: Add enums to `lib/enums.ts`**

Add before the closing of the file (after the `UsageFeature` enum added in Task 1):

```typescript
// =============================================================================
// AI Visibility Enums
// =============================================================================

export enum AIPlatform {
  ChatGPT = 'chatgpt',
  Claude = 'claude',
  Perplexity = 'perplexity',
}

export enum SyncFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export enum BrandSentiment {
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative',
}

export enum PromptSource {
  AutoGenerated = 'auto_generated',
  Manual = 'manual',
}
```

**Step 2: Write the failing test for types**

Create `tests/unit/lib/ai-visibility/types.test.ts`:

```typescript
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
```

**Step 3: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/types.test.ts`
Expected: FAIL — module `@/lib/ai-visibility/types` does not exist

**Step 4: Create the types file**

Create `lib/ai-visibility/types.ts`:

```typescript
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
  prompt_id: string
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
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/types.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add lib/enums.ts lib/ai-visibility/types.ts tests/unit/lib/ai-visibility/types.test.ts
git commit -m "feat: add AI Visibility types, enums, and display name maps"
```

---

### Task 5: Navigation restructure

Split "SEO / AIO" into "SEO" and "AI Visibility" sections.

**Files:**
- Modify: `components/navigation/child-sidebar.tsx`

**Step 1: Update the `homeNavigation` config**

In `components/navigation/child-sidebar.tsx`, find the `homeNavigation` array and replace the `'SEO / AIO'` group with two separate groups. You will need to add the `Eye` icon import from `lucide-react` for the AI Visibility items.

Change from:
```typescript
{
  header: 'SEO / AIO',
  items: [
    { name: 'Full Site Audit', href: '/seo/audit', icon: ClipboardCheck },
    { name: 'Client Reports', href: '/seo/client-reports', icon: FileText },
  ],
},
```

Change to:
```typescript
{
  header: 'SEO',
  items: [
    { name: 'Full Site Audit', href: '/seo/audit', icon: ClipboardCheck },
    { name: 'Client Reports', href: '/seo/client-reports', icon: FileText },
  ],
},
{
  header: 'AI Visibility',
  items: [
    { name: 'Overview', href: '/ai-visibility', icon: Eye },
    { name: 'Prompts', href: '/ai-visibility/prompts', icon: MessageSquareText },
    { name: 'Brand Mentions', href: '/ai-visibility/mentions', icon: AtSign },
    { name: 'Site Audit', href: '/seo/aio', icon: Bot },
  ],
},
```

Add these to the existing lucide-react import: `Eye`, `MessageSquareText`, `AtSign`, `Bot`.

**Step 2: Verify the build compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (the pages don't exist yet, but the nav links are just `<a>` tags)

**Step 3: Commit**

```bash
git add components/navigation/child-sidebar.tsx
git commit -m "feat: split navigation into separate SEO and AI Visibility sections"
```

---

### Task 6: Stub route pages for AI Visibility

Create placeholder pages so the nav links don't 404.

**Files:**
- Create: `app/(authenticated)/[orgId]/ai-visibility/page.tsx`
- Create: `app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx`
- Create: `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx`
- Create: `app/(authenticated)/[orgId]/ai-visibility/layout.tsx`

**Step 1: Create layout**

Create `app/(authenticated)/[orgId]/ai-visibility/layout.tsx`:

```typescript
export default function AIVisibilityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Step 2: Create Overview stub page**

Create `app/(authenticated)/[orgId]/ai-visibility/page.tsx`:

```typescript
import { EmptyState } from '@/components/ui/empty-state'
import { Eye } from 'lucide-react'

export default function AIVisibilityOverviewPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">AI Visibility</h1>
      <EmptyState
        icon={Eye}
        title="Coming soon"
        description="Track how your brand appears in AI-generated responses across ChatGPT, Claude, and Perplexity."
      />
    </div>
  )
}
```

**Step 3: Create Prompts stub page**

Create `app/(authenticated)/[orgId]/ai-visibility/prompts/page.tsx`:

```typescript
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquareText } from 'lucide-react'

export default function AIVisibilityPromptsPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">Prompts</h1>
      <EmptyState
        icon={MessageSquareText}
        title="No prompts configured"
        description="Add topics and prompts to start tracking your brand's AI visibility."
      />
    </div>
  )
}
```

**Step 4: Create Brand Mentions stub page**

Create `app/(authenticated)/[orgId]/ai-visibility/mentions/page.tsx`:

```typescript
import { EmptyState } from '@/components/ui/empty-state'
import { AtSign } from 'lucide-react'

export default function AIVisibilityMentionsPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">Brand Mentions</h1>
      <EmptyState
        icon={AtSign}
        title="No mentions yet"
        description="Brand mentions will appear here after your first AI visibility sync."
      />
    </div>
  )
}
```

**Step 5: Update navigation shell route mapping**

Check `components/navigation/navigation-shell.tsx` for the route-to-section mapping. The `/ai-visibility/*` routes need to map to the Home section (same as `/seo/*`). Find the section derivation logic and add `ai-visibility` to the paths that map to `home`.

**Step 6: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/ai-visibility/
git add components/navigation/navigation-shell.tsx
git commit -m "feat: add stub pages for AI Visibility routes"
```

---

### Task 7: Verify everything together

**Step 1: Run full lint + test + build**

Run: `npm run lint && npx vitest run tests/unit && npm run build`
Expected: ALL PASS

**Step 2: Apply migrations and test locally**

Run: `supabase db reset`
Expected: All migrations apply cleanly

**Step 3: Verify locally**

Start dev server and verify:
- Navigation shows "SEO" and "AI Visibility" as separate sections
- All three AI Visibility nav links work (show stub pages)
- Existing SEO pages still work

**Step 4: Final commit if any fixes needed, then push**

```bash
git push
```

---

### Task 8: CLI command — `sync:ai-visibility`

Add a script to programmatically trigger the AI Visibility pipeline for a specific organization, following the same patterns as `sync:metrics` and `backfill:metrics`.

**Files:**
- Create: `scripts/sync-ai-visibility.ts`
- Modify: `package.json` (add script entries)

**Step 1: Create the script**

Create `scripts/sync-ai-visibility.ts` following the existing patterns:

```typescript
// Usage:
//   npm run sync:ai-visibility -- --org=<uuid>           (local)
//   npm run sync:ai-visibility -- --org=<uuid> --prod    (production)
//   npm run sync:ai-visibility -- --org=<uuid> --dry-run (preview only)
```

The script should:
1. Parse `--org=<uuid>` (required), `--prod`, and `--dry-run` flags from `process.argv`
2. Load `.env.local` or `.env` based on `--prod` flag
3. Create a Supabase service client
4. Verify the organization exists and has an `ai_visibility_configs` row with `is_active: true`
5. Call the same pipeline function that the future cron job will use (e.g., `runAIVisibilitySync(organizationId)` from `lib/ai-visibility/sync.ts`)
6. Log progress and results to console

**Architecture note:** The pipeline function (`runAIVisibilitySync`) doesn't exist yet — it will be built in Phase 2. The script should be structured so it calls that function once it exists. For now, the script can:
- Validate the org and config exist
- Print what *would* be synced (topics, prompts, platforms)
- Exit with a message that the sync engine is not yet implemented

This way the CLI is ready to go the moment the pipeline is built.

**Step 2: Add package.json entries**

```json
"sync:ai-visibility": "tsx scripts/sync-ai-visibility.ts",
"sync:ai-visibility:prod": "tsx scripts/sync-ai-visibility.ts --prod"
```

**Step 3: Write test**

Create `tests/unit/scripts/sync-ai-visibility.test.ts` to verify argument parsing and validation logic (extract the arg parser into a testable function).

**Step 4: Commit**

```bash
git add scripts/sync-ai-visibility.ts package.json tests/unit/scripts/sync-ai-visibility.test.ts
git commit -m "feat: add sync:ai-visibility CLI command (pipeline stub)"
```
