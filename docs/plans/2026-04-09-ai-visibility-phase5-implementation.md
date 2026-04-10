# Modular Audit Architecture & AIO Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the unified audit into a modular plugin system with three self-contained modules (SEO, Performance, AI Readiness), change AI Readiness blend to 50/50, add module-level re-run support, then remove the standalone AIO system.

**Architecture:** Each score dimension (SEO, Performance, AI Readiness) becomes an `AuditModule` plugin that owns its checks, optional post-crawl phase, and scoring function. A central registry exports all modules. The runner orchestrates: crawl once, execute modules in parallel via `Promise.allSettled`, store per-module timings/statuses/errors. Modules can be re-run independently against existing crawled pages.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL), TypeScript, Vitest

---

## Context for Implementers

### Key Files You'll Touch

- `lib/unified-audit/types.ts` — Add `AuditModule` interface and related types
- `lib/unified-audit/modules/` — New directory for module definitions and registry
- `lib/unified-audit/runner.ts` — Refactor to loop through modules
- `lib/unified-audit/scoring.ts` — Simplify, delegate to modules
- `lib/unified-audit/ai-runner.ts` — Moves to `modules/ai-readiness/ai-phase.ts`
- `lib/unified-audit/psi-runner.ts` — Moves to `modules/performance/psi-phase.ts`
- `lib/unified-audit/checks/index.ts` — Add `getChecksByScore()` (already exists)
- `lib/enums.ts` — Add `CompletedWithErrors` to `UnifiedAuditStatus`
- `app/(authenticated)/[orgId]/seo/audit/[id]/actions.ts` — Add `rerunModule` server action
- `app/(authenticated)/[orgId]/seo/audit/[id]/client.tsx` — Add retry button for failed modules
- `components/audit/unified-score-cards.tsx` — Add partial score tooltip

### Existing Patterns to Follow

- **Check definitions** use `AuditCheckDefinition` from `lib/unified-audit/types.ts`
- **Checks index** at `lib/unified-audit/checks/index.ts` uses `getChecksByScore(dimension)` to filter
- **Scoring** uses `calculateCheckScore(checks)` with priority weights (Critical=3, Recommended=2, Optional=1)
- **Error logging** follows `console.error('[Context]', { type, timestamp })` convention
- **Server actions** use `withAuth` or direct `supabase.auth.getUser()` + access checks
- **Database operations** use `createServiceClient()` to bypass RLS

### What NOT to Change

- Individual check files — they stay where they are, no modifications
- The crawl phase (crawler, batch-crawler) — unchanged
- The `checks/index.ts` aggregation — it still exports all checks; modules use `getChecksByScore()`
- Existing tests for individual checks — they continue to pass
- **CRITICAL: Vercel timeout handling** — `runUnifiedAuditBatch` uses `MAX_FUNCTION_DURATION_MS` (500s) and `triggerContinuation` to self-continue via `POST /api/unified-audit/{id}/continue` when approaching Vercel's 800s function timeout. This batch continuation loop MUST remain intact. The module execution happens inside `completeAuditScoring` / `finishUnifiedAudit`, which are always called in a **fresh function invocation** after the crawl loop completes — so the timeout budget applies only to crawling, not to module execution. Do NOT move module execution into the crawl loop or the batch continuation logic.

---

## Task 1: Module Type Definitions

**Files:**

- Modify: `lib/unified-audit/types.ts`
- Modify: `lib/enums.ts`

**Step 1: Add `CompletedWithErrors` to `UnifiedAuditStatus` enum**

In `lib/enums.ts`, add a new value to the `UnifiedAuditStatus` enum:

```typescript
export enum UnifiedAuditStatus {
  Pending = 'pending',
  Crawling = 'crawling',
  AwaitingConfirmation = 'awaiting_confirmation',
  Checking = 'checking',
  Analyzing = 'analyzing',
  Completed = 'completed',
  CompletedWithErrors = 'completed_with_errors', // <-- NEW
  Failed = 'failed',
  Stopped = 'stopped',
  BatchComplete = 'batch_complete',
}
```

**Step 2: Verify no switch statements break**

Run: `npx grep -rn "UnifiedAuditStatus" lib/ app/ components/ --include="*.ts" --include="*.tsx" | grep -i "switch\|case"`

Check that no exhaustive switch statements need updating. If any do, add the new case.

**Step 3: Add module types to `lib/unified-audit/types.ts`**

Add at the end of the file, before the `ScoreWeights` section:

```typescript
// =============================================================================
// Module System Types
// =============================================================================

export type ModuleStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ModuleError {
  phase: 'checks' | 'post_crawl' | 'scoring'
  message: string
  timestamp: string
}

export interface PostCrawlContext {
  auditId: string
  url: string
  allPages: AuditPage[]
  sampleSize: number
  organizationId: string | null
}

export interface PostCrawlResult {
  strategicScore: number | null
  [key: string]: unknown
}

export interface AuditModule {
  dimension: ScoreDimension
  checks: AuditCheckDefinition[]
  runPostCrawlPhase?: (context: PostCrawlContext) => Promise<PostCrawlResult>
  calculateScore: (checks: AuditCheck[], phaseResult?: PostCrawlResult) => number
}
```

**Step 4: Add `module_timings`, `module_statuses`, `module_errors` to `UnifiedAudit` interface**

In `lib/unified-audit/types.ts`, add to the `UnifiedAudit` interface after the `use_relaxed_ssl` field:

```typescript
// Module execution metadata
module_timings: Record<string, number>
module_statuses: Record<string, ModuleStatus>
module_errors: Record<string, ModuleError>
```

**Step 5: Commit**

```bash
git add lib/unified-audit/types.ts lib/enums.ts
git commit -m "feat: add AuditModule type definitions and CompletedWithErrors status"
```

---

## Task 2: Database Migration

**Files:**

- Create: `supabase/migrations/20260409120000_add_module_columns_to_audits.sql`

**Step 1: Create migration file**

```sql
-- Add module execution tracking columns to audits table
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS module_timings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS module_statuses JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS module_errors JSONB NOT NULL DEFAULT '{}';

-- Add completed_with_errors to the audit status check constraint if one exists
-- (Supabase uses the enum type, so we need to add the new value)
DO $$
BEGIN
  -- Check if the value already exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'completed_with_errors'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'unified_audit_status')
  ) THEN
    ALTER TYPE unified_audit_status ADD VALUE 'completed_with_errors';
  END IF;
END
$$;
```

**Step 2: Verify the enum type name**

Run: `grep -r "unified_audit_status\|CREATE TYPE.*audit.*status" supabase/migrations/ | head -5`

If the type name differs, adjust the migration accordingly. The type may be named differently — check the original migration that created the `status` column on `audits`.

**Step 3: Apply migration locally**

Run: `supabase db reset`

Verify the columns exist:

```bash
supabase db query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audits' AND column_name IN ('module_timings', 'module_statuses', 'module_errors')"
```

Expected: 3 rows, all `jsonb`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260409120000_add_module_columns_to_audits.sql
git commit -m "feat: add module_timings, module_statuses, module_errors columns to audits"
```

---

## Task 3: SEO Module

**Files:**

- Create: `lib/unified-audit/modules/seo/index.ts`
- Create: `lib/unified-audit/modules/seo/scoring.ts`
- Create: `tests/unit/lib/unified-audit/modules/seo/scoring.test.ts`

**Step 1: Write the scoring tests**

Create `tests/unit/lib/unified-audit/modules/seo/scoring.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { calculateSEOModuleScore } from '@/lib/unified-audit/modules/seo/scoring'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'crawlability' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status: CheckStatus.Passed,
    display_name: 'Test Check',
    display_name_passed: 'Test Check',
    description: 'A test check',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [],
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('calculateSEOModuleScore', () => {
  test('returns 0 for empty checks', () => {
    expect(calculateSEOModuleScore([])).toBe(0)
  })

  test('returns 100 for all passed checks', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Recommended }),
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Optional }),
    ]
    expect(calculateSEOModuleScore(checks)).toBe(100)
  })

  test('returns 0 for all failed checks', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Recommended }),
    ]
    expect(calculateSEOModuleScore(checks)).toBe(0)
  })

  test('weights critical checks 3x, recommended 2x, optional 1x', () => {
    // 1 Critical passed (3 * 100 = 300), 1 Recommended failed (2 * 0 = 0)
    // Total weight = 5, earned = 300, score = 300/500 * 100 = 60
    const checks = [
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Recommended }),
    ]
    expect(calculateSEOModuleScore(checks)).toBe(60)
  })

  test('scores warnings at 50 points', () => {
    // 1 Recommended warning (2 * 50 = 100), total weight = 2
    // 100 / 200 * 100 = 50
    const checks = [makeCheck({ status: CheckStatus.Warning, priority: CheckPriority.Recommended })]
    expect(calculateSEOModuleScore(checks)).toBe(50)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/seo/scoring.test.ts`

Expected: FAIL — module doesn't exist yet.

**Step 3: Create the SEO scoring module**

Create `lib/unified-audit/modules/seo/scoring.ts`:

```typescript
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck } from '../../types'

const PRIORITY_WEIGHTS: Record<string, number> = {
  [CheckPriority.Critical]: 3,
  [CheckPriority.Recommended]: 2,
  [CheckPriority.Optional]: 1,
}

const STATUS_POINTS: Record<string, number> = {
  [CheckStatus.Passed]: 100,
  [CheckStatus.Warning]: 50,
  [CheckStatus.Failed]: 0,
}

/**
 * Calculate SEO score from weighted check results.
 * Critical=3x, Recommended=2x, Optional=1x.
 * Passed=100pts, Warning=50pts, Failed=0pts.
 */
export function calculateSEOModuleScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0
  let totalWeight = 0
  let earnedWeight = 0
  for (const check of checks) {
    const weight = PRIORITY_WEIGHTS[check.priority] ?? 1
    totalWeight += weight
    earnedWeight += weight * (STATUS_POINTS[check.status] ?? 0)
  }
  if (totalWeight === 0) return 0
  return Math.round((earnedWeight / (totalWeight * 100)) * 100)
}
```

**Step 4: Create the SEO module index**

Create `lib/unified-audit/modules/seo/index.ts`:

```typescript
import { ScoreDimension } from '@/lib/enums'
import { getChecksByScore } from '../../checks'
import { calculateSEOModuleScore } from './scoring'
import type { AuditModule } from '../../types'

export const seoModule: AuditModule = {
  dimension: ScoreDimension.SEO,
  checks: getChecksByScore(ScoreDimension.SEO),
  calculateScore: (checks) => calculateSEOModuleScore(checks),
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/seo/scoring.test.ts`

Expected: 5 tests PASS.

**Step 6: Commit**

```bash
git add lib/unified-audit/modules/seo/ tests/unit/lib/unified-audit/modules/seo/
git commit -m "feat: add SEO audit module with scoring"
```

---

## Task 4: Performance Module

**Files:**

- Create: `lib/unified-audit/modules/performance/index.ts`
- Create: `lib/unified-audit/modules/performance/scoring.ts`
- Create: `lib/unified-audit/modules/performance/psi-phase.ts`
- Create: `tests/unit/lib/unified-audit/modules/performance/scoring.test.ts`

**Step 1: Write the scoring tests**

Create `tests/unit/lib/unified-audit/modules/performance/scoring.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { calculatePerformanceModuleScore } from '@/lib/unified-audit/modules/performance/scoring'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'performance' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status: CheckStatus.Passed,
    display_name: 'Test Check',
    display_name_passed: 'Test Check',
    description: 'A test check',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [],
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('calculatePerformanceModuleScore', () => {
  test('returns 0 for empty checks', () => {
    expect(calculatePerformanceModuleScore([])).toBe(0)
  })

  test('returns 100 for all passed checks', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Recommended }),
    ]
    expect(calculatePerformanceModuleScore(checks)).toBe(100)
  })

  test('returns 0 for all failed checks', () => {
    const checks = [makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical })]
    expect(calculatePerformanceModuleScore(checks)).toBe(0)
  })

  test('weights critical checks 3x, recommended 2x, optional 1x', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Recommended }),
    ]
    expect(calculatePerformanceModuleScore(checks)).toBe(60)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/performance/scoring.test.ts`

Expected: FAIL.

**Step 3: Create the Performance scoring module**

Create `lib/unified-audit/modules/performance/scoring.ts`:

```typescript
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck } from '../../types'

const PRIORITY_WEIGHTS: Record<string, number> = {
  [CheckPriority.Critical]: 3,
  [CheckPriority.Recommended]: 2,
  [CheckPriority.Optional]: 1,
}

const STATUS_POINTS: Record<string, number> = {
  [CheckStatus.Passed]: 100,
  [CheckStatus.Warning]: 50,
  [CheckStatus.Failed]: 0,
}

/**
 * Calculate Performance score from weighted check results.
 */
export function calculatePerformanceModuleScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0
  let totalWeight = 0
  let earnedWeight = 0
  for (const check of checks) {
    const weight = PRIORITY_WEIGHTS[check.priority] ?? 1
    totalWeight += weight
    earnedWeight += weight * (STATUS_POINTS[check.status] ?? 0)
  }
  if (totalWeight === 0) return 0
  return Math.round((earnedWeight / (totalWeight * 100)) * 100)
}
```

**Step 4: Move the PSI phase logic**

Create `lib/unified-audit/modules/performance/psi-phase.ts` by moving the logic from `lib/unified-audit/psi-runner.ts`. The key change is conforming to the `PostCrawlResult` return type:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import {
  fetchPageSpeedInsights,
  extractOpportunities,
  extractDiagnostics,
} from '@/lib/performance/api'
import type { PageSpeedResult } from '@/lib/performance/types'
import { selectTopPages } from '@/lib/aio/importance'
import { lighthouseScores } from '../../checks/performance/lighthouse-scores'
import { coreWebVitals } from '../../checks/performance/core-web-vitals'
import { pageResponseTime } from '../../checks/performance/page-response-time'
import { buildCheckRecord } from '../../runner'
import { DeviceType } from '@/lib/enums'
import type { AuditCheck, CheckContext, PostCrawlContext, PostCrawlResult } from '../../types'
import type { SiteAuditPage } from '@/lib/audit/types'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'

const PERFORMANCE_CHECK_NAMES = [lighthouseScores.name, coreWebVitals.name, pageResponseTime.name]
const PERFORMANCE_CHECKS = [lighthouseScores, coreWebVitals, pageResponseTime]

function toSiteAuditPage(page: {
  id: string
  audit_id: string
  url: string
  title: string | null
  meta_description: string | null
  status_code: number | null
  last_modified: string | null
  created_at: string
  is_resource: boolean
  resource_type: string | null
}): SiteAuditPage {
  return {
    id: page.id,
    audit_id: page.audit_id,
    url: page.url,
    title: page.title,
    meta_description: page.meta_description,
    status_code: page.status_code,
    last_modified: page.last_modified,
    crawled_at: page.created_at,
    is_resource: page.is_resource,
    resource_type: page.resource_type,
  }
}

/**
 * PSI post-crawl phase for the Performance module.
 * Fetches PageSpeed Insights for top pages and replaces placeholder performance checks.
 */
export async function runPSIPhase(context: PostCrawlContext): Promise<PostCrawlResult> {
  if (!process.env.PAGESPEED_API_KEY) {
    console.log('[PSI Phase] Skipping — PAGESPEED_API_KEY not set')
    return { strategicScore: null, pagesAnalyzed: 0, checksUpserted: 0 }
  }

  const supabase = createServiceClient()
  const { auditId, url, allPages, sampleSize, organizationId } = context

  const htmlPages = allPages.filter(
    (p) => !p.is_resource && (!p.status_code || p.status_code < 400)
  )

  if (htmlPages.length === 0) {
    return { strategicScore: null, pagesAnalyzed: 0, checksUpserted: 0 }
  }

  const siteAuditPages = htmlPages.map(toSiteAuditPage)
  const topPages = selectTopPages(siteAuditPages, url, sampleSize)

  let pagesAnalyzed = 0
  let checksUpserted = 0

  for (const pageImportance of topPages) {
    try {
      console.log(`[PSI Phase] Fetching PSI for ${pageImportance.url}`)

      const psiResult = await fetchPageSpeedInsights({
        url: pageImportance.url,
        device: DeviceType.Mobile,
      })

      await logUsage('pagespeed', 'psi_fetch', {
        organizationId,
        feature: UsageFeature.SiteAudit,
        metadata: { auditId, pageUrl: pageImportance.url },
      })

      await supabase
        .from('audit_checks')
        .delete()
        .eq('audit_id', auditId)
        .eq('page_url', pageImportance.url)
        .in('check_name', PERFORMANCE_CHECK_NAMES)

      const opportunities = extractOpportunities(psiResult as PageSpeedResult)
        .slice(0, 5)
        .map((o) => ({ title: o.title, displayValue: o.displayValue }))
      const diagnostics = extractDiagnostics(psiResult as PageSpeedResult).map((d) => ({
        title: d.title,
        displayValue: d.displayValue,
      }))

      const checkContext: CheckContext = {
        url: pageImportance.url,
        html: '',
        psiData: psiResult as unknown as Record<string, unknown>,
        psiOpportunities: opportunities,
        psiDiagnostics: diagnostics,
      }

      const newChecks: AuditCheck[] = []

      for (const check of PERFORMANCE_CHECKS) {
        try {
          const result = await check.run(checkContext)
          const checkRecord = buildCheckRecord(auditId, pageImportance.url, check, result)
          if (checkRecord.details) {
            checkRecord.details.source = 'psi'
          } else {
            checkRecord.details = { source: 'psi' }
          }
          newChecks.push(checkRecord)
        } catch (error) {
          console.error(`[PSI Phase] Check ${check.name} failed for ${pageImportance.url}:`, error)
        }
      }

      if (newChecks.length > 0) {
        await supabase.from('audit_checks').insert(newChecks)
        checksUpserted += newChecks.length
      }

      pagesAnalyzed++
    } catch (error) {
      console.error(`[PSI Phase] Failed to fetch PSI for ${pageImportance.url}:`, error)
    }
  }

  console.log(
    `[PSI Phase] Completed: ${pagesAnalyzed}/${topPages.length} pages, ${checksUpserted} checks upserted`
  )

  return { strategicScore: null, pagesAnalyzed, checksUpserted }
}
```

**Step 5: Create the Performance module index**

Create `lib/unified-audit/modules/performance/index.ts`:

```typescript
import { ScoreDimension } from '@/lib/enums'
import { getChecksByScore } from '../../checks'
import { calculatePerformanceModuleScore } from './scoring'
import { runPSIPhase } from './psi-phase'
import type { AuditModule } from '../../types'

export const performanceModule: AuditModule = {
  dimension: ScoreDimension.Performance,
  checks: getChecksByScore(ScoreDimension.Performance),
  runPostCrawlPhase: runPSIPhase,
  calculateScore: (checks) => calculatePerformanceModuleScore(checks),
}
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/performance/scoring.test.ts`

Expected: 4 tests PASS.

**Step 7: Commit**

```bash
git add lib/unified-audit/modules/performance/ tests/unit/lib/unified-audit/modules/performance/
git commit -m "feat: add Performance audit module with PSI phase and scoring"
```

---

## Task 5: AI Readiness Module

**Files:**

- Create: `lib/unified-audit/modules/ai-readiness/index.ts`
- Create: `lib/unified-audit/modules/ai-readiness/scoring.ts`
- Create: `lib/unified-audit/modules/ai-readiness/ai-phase.ts`
- Create: `tests/unit/lib/unified-audit/modules/ai-readiness/scoring.test.ts`

**Step 1: Write the scoring tests**

Create `tests/unit/lib/unified-audit/modules/ai-readiness/scoring.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { calculateAIReadinessModuleScore } from '@/lib/unified-audit/modules/ai-readiness/scoring'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck, PostCrawlResult } from '@/lib/unified-audit/types'

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'ai_visibility' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status: CheckStatus.Passed,
    display_name: 'Test Check',
    display_name_passed: 'Test Check',
    description: 'A test check',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [],
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('calculateAIReadinessModuleScore', () => {
  test('returns 0 for empty checks and no AI result', () => {
    expect(calculateAIReadinessModuleScore([])).toBe(0)
  })

  test('returns 100% programmatic when no post-crawl result', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    expect(calculateAIReadinessModuleScore(checks)).toBe(100)
  })

  test('returns 100% programmatic when strategicScore is null', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: null }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(100)
  })

  test('blends 50/50 when strategicScore is provided', () => {
    // Programmatic: 1 critical passed = 100
    // Strategic: 80
    // Blended: 100 * 0.5 + 80 * 0.5 = 90
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 80 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(90)
  })

  test('blends with 0 programmatic score', () => {
    // Programmatic: 1 critical failed = 0
    // Strategic: 60
    // Blended: 0 * 0.5 + 60 * 0.5 = 30
    const checks = [makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 60 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(30)
  })

  test('blends with 0 strategic score', () => {
    // Programmatic: 1 critical passed = 100
    // Strategic: 0
    // Blended: 100 * 0.5 + 0 * 0.5 = 50
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 0 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(50)
  })

  test('both scores at 100', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 100 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(100)
  })

  test('both scores at 0', () => {
    const checks = [makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 0 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/ai-readiness/scoring.test.ts`

Expected: FAIL.

**Step 3: Create the AI Readiness scoring module**

Create `lib/unified-audit/modules/ai-readiness/scoring.ts`:

```typescript
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck, PostCrawlResult } from '../../types'

const PRIORITY_WEIGHTS: Record<string, number> = {
  [CheckPriority.Critical]: 3,
  [CheckPriority.Recommended]: 2,
  [CheckPriority.Optional]: 1,
}

const STATUS_POINTS: Record<string, number> = {
  [CheckStatus.Passed]: 100,
  [CheckStatus.Warning]: 50,
  [CheckStatus.Failed]: 0,
}

function calculateCheckScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0
  let totalWeight = 0
  let earnedWeight = 0
  for (const check of checks) {
    const weight = PRIORITY_WEIGHTS[check.priority] ?? 1
    totalWeight += weight
    earnedWeight += weight * (STATUS_POINTS[check.status] ?? 0)
  }
  if (totalWeight === 0) return 0
  return Math.round((earnedWeight / (totalWeight * 100)) * 100)
}

/**
 * Calculate AI Readiness score.
 * 50% programmatic checks + 50% Claude strategic score.
 * Falls back to 100% programmatic when no AI analysis is available.
 */
export function calculateAIReadinessModuleScore(
  checks: AuditCheck[],
  phaseResult?: PostCrawlResult
): number {
  const programmaticScore = calculateCheckScore(checks)
  const strategicScore = phaseResult?.strategicScore as number | null | undefined
  if (strategicScore === null || strategicScore === undefined) return programmaticScore
  return Math.round(programmaticScore * 0.5 + strategicScore * 0.5)
}
```

**Step 4: Move the AI analysis phase logic**

Create `lib/unified-audit/modules/ai-readiness/ai-phase.ts` by adapting `lib/unified-audit/ai-runner.ts` to use the `PostCrawlContext` / `PostCrawlResult` interfaces:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { selectTopPages } from '@/lib/aio/importance'
import { runAIAnalysis, calculateStrategicScore } from '@/lib/aio/ai-auditor'
import type { PageContent } from '@/lib/aio/ai-auditor'
import { fetchPage } from '@/lib/audit/fetcher'
import type { AuditAIAnalysis, PostCrawlContext, PostCrawlResult } from '../../types'
import type { SiteAuditPage } from '@/lib/audit/types'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'

function toSiteAuditPage(page: {
  id: string
  audit_id: string
  url: string
  title: string | null
  meta_description: string | null
  status_code: number | null
  last_modified: string | null
  created_at: string
  is_resource: boolean
  resource_type: string | null
}): SiteAuditPage {
  return {
    id: page.id,
    audit_id: page.audit_id,
    url: page.url,
    title: page.title,
    meta_description: page.meta_description,
    status_code: page.status_code,
    last_modified: page.last_modified,
    crawled_at: page.created_at,
    is_resource: page.is_resource,
    resource_type: page.resource_type,
  }
}

/**
 * AI analysis post-crawl phase for the AI Readiness module.
 * Analyzes top pages with Claude and returns strategic score for blending.
 */
export async function runAIPhase(context: PostCrawlContext): Promise<PostCrawlResult> {
  const supabase = createServiceClient()
  const { auditId, url, allPages, sampleSize, organizationId } = context

  // Check if AI analysis is enabled on the audit
  const { data: audit } = await supabase
    .from('audits')
    .select('ai_analysis_enabled')
    .eq('id', auditId)
    .single()

  if (!audit?.ai_analysis_enabled) {
    console.log('[AI Phase] Skipping — AI analysis disabled for this audit')
    return { strategicScore: null, pagesAnalyzed: 0 }
  }

  const htmlPages = allPages.filter(
    (p) => !p.is_resource && (!p.status_code || p.status_code < 400)
  )

  if (htmlPages.length === 0) {
    return { strategicScore: null, pagesAnalyzed: 0 }
  }

  const siteAuditPages = htmlPages.map(toSiteAuditPage)
  const topPages = selectTopPages(siteAuditPages, url, sampleSize)

  const pageContents: PageContent[] = []
  for (const pageImportance of topPages) {
    try {
      const { html, error } = await fetchPage(pageImportance.url)
      if (html && !error) {
        pageContents.push({ url: pageImportance.url, html })
      }
    } catch (error) {
      console.error(`[AI Phase] Failed to fetch ${pageImportance.url}:`, error)
    }
  }

  if (pageContents.length === 0) {
    console.log('[AI Phase] No pages could be fetched for analysis')
    return { strategicScore: null, pagesAnalyzed: 0 }
  }

  console.log(`[AI Phase] Analyzing ${pageContents.length} pages with Claude`)

  const startTime = Date.now()
  const batchResult = await runAIAnalysis(pageContents)
  const executionTimeMs = Date.now() - startTime

  await logUsage('anthropic', 'ai_analysis', {
    organizationId,
    feature: UsageFeature.SiteAudit,
    tokensInput: batchResult.totalInputTokens,
    tokensOutput: batchResult.totalOutputTokens,
    cost: batchResult.totalCost,
    metadata: { auditId, pagesAnalyzed: batchResult.analyses.length },
  })

  const importanceLookup = new Map(topPages.map((p) => [p.url, p]))

  const aiAnalysisRows: Omit<AuditAIAnalysis, 'id' | 'created_at'>[] = batchResult.analyses.map(
    (analysis) => {
      const importance = importanceLookup.get(analysis.url)
      return {
        audit_id: auditId,
        page_url: analysis.url,
        importance_score: importance?.importanceScore ?? 0,
        importance_reasons: importance?.reasons ?? [],
        score_data_quality: analysis.scores.dataQuality,
        score_expert_credibility: analysis.scores.expertCredibility,
        score_comprehensiveness: analysis.scores.comprehensiveness,
        score_citability: analysis.scores.citability,
        score_authority: analysis.scores.authority,
        score_overall: analysis.scores.overall,
        findings: (analysis.findings ?? {}) as Record<string, unknown>,
        recommendations: analysis.recommendations as unknown as Record<string, unknown>,
        platform_readiness: null,
        citability_passages: null,
        input_tokens: Math.round(batchResult.totalInputTokens / batchResult.analyses.length),
        output_tokens: Math.round(batchResult.totalOutputTokens / batchResult.analyses.length),
        cost: batchResult.totalCost / batchResult.analyses.length,
        execution_time_ms: Math.round(executionTimeMs / batchResult.analyses.length),
      }
    }
  )

  if (aiAnalysisRows.length > 0) {
    const { error } = await supabase.from('audit_ai_analyses').insert(aiAnalysisRows)
    if (error) {
      console.error('[AI Phase] Failed to insert AI analyses:', error)
    }
  }

  await supabase
    .from('audits')
    .update({
      total_input_tokens: batchResult.totalInputTokens,
      total_output_tokens: batchResult.totalOutputTokens,
      total_cost: batchResult.totalCost,
    })
    .eq('id', auditId)

  const strategicScore = calculateStrategicScore(batchResult.analyses)

  console.log(
    `[AI Phase] Completed: ${batchResult.analyses.length} pages, strategic score=${strategicScore}, cost=$${batchResult.totalCost.toFixed(4)}`
  )

  return {
    strategicScore,
    pagesAnalyzed: batchResult.analyses.length,
    totalInputTokens: batchResult.totalInputTokens,
    totalOutputTokens: batchResult.totalOutputTokens,
    totalCost: batchResult.totalCost,
  }
}
```

**Step 5: Create the AI Readiness module index**

Create `lib/unified-audit/modules/ai-readiness/index.ts`:

```typescript
import { ScoreDimension } from '@/lib/enums'
import { getChecksByScore } from '../../checks'
import { calculateAIReadinessModuleScore } from './scoring'
import { runAIPhase } from './ai-phase'
import type { AuditModule } from '../../types'

export const aiReadinessModule: AuditModule = {
  dimension: ScoreDimension.AIReadiness,
  checks: getChecksByScore(ScoreDimension.AIReadiness),
  runPostCrawlPhase: runAIPhase,
  calculateScore: (checks, phaseResult) => calculateAIReadinessModuleScore(checks, phaseResult),
}
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/ai-readiness/scoring.test.ts`

Expected: 8 tests PASS.

**Step 7: Commit**

```bash
git add lib/unified-audit/modules/ai-readiness/ tests/unit/lib/unified-audit/modules/ai-readiness/
git commit -m "feat: add AI Readiness audit module with 50/50 blend scoring and AI phase"
```

---

## Task 6: Module Registry

**Files:**

- Create: `lib/unified-audit/modules/registry.ts`
- Create: `tests/unit/lib/unified-audit/modules/registry.test.ts`

**Step 1: Write registry tests**

Create `tests/unit/lib/unified-audit/modules/registry.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { auditModules, getModule } from '@/lib/unified-audit/modules/registry'
import { ScoreDimension } from '@/lib/enums'

describe('auditModules registry', () => {
  test('exports exactly 3 modules', () => {
    expect(auditModules).toHaveLength(3)
  })

  test('each module has a unique dimension', () => {
    const dimensions = auditModules.map((m) => m.dimension)
    expect(new Set(dimensions).size).toBe(3)
  })

  test('contains SEO, Performance, and AIReadiness modules', () => {
    const dimensions = auditModules.map((m) => m.dimension)
    expect(dimensions).toContain(ScoreDimension.SEO)
    expect(dimensions).toContain(ScoreDimension.Performance)
    expect(dimensions).toContain(ScoreDimension.AIReadiness)
  })

  test('each module has a non-empty checks array', () => {
    for (const mod of auditModules) {
      expect(mod.checks.length).toBeGreaterThan(0)
    }
  })

  test('each module has a calculateScore function', () => {
    for (const mod of auditModules) {
      expect(typeof mod.calculateScore).toBe('function')
    }
  })

  test('only Performance and AIReadiness have post-crawl phases', () => {
    const seo = auditModules.find((m) => m.dimension === ScoreDimension.SEO)!
    const perf = auditModules.find((m) => m.dimension === ScoreDimension.Performance)!
    const ai = auditModules.find((m) => m.dimension === ScoreDimension.AIReadiness)!
    expect(seo.runPostCrawlPhase).toBeUndefined()
    expect(perf.runPostCrawlPhase).toBeDefined()
    expect(ai.runPostCrawlPhase).toBeDefined()
  })
})

describe('getModule', () => {
  test('returns module for valid dimension', () => {
    const mod = getModule(ScoreDimension.SEO)
    expect(mod).toBeDefined()
    expect(mod!.dimension).toBe(ScoreDimension.SEO)
  })

  test('returns undefined for invalid dimension', () => {
    const mod = getModule('invalid' as ScoreDimension)
    expect(mod).toBeUndefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/registry.test.ts`

Expected: FAIL.

**Step 3: Create the registry**

Create `lib/unified-audit/modules/registry.ts`:

```typescript
import { seoModule } from './seo'
import { performanceModule } from './performance'
import { aiReadinessModule } from './ai-readiness'
import type { AuditModule } from '../types'
import type { ScoreDimension } from '@/lib/enums'

export const auditModules: AuditModule[] = [seoModule, performanceModule, aiReadinessModule]

export function getModule(dimension: ScoreDimension): AuditModule | undefined {
  return auditModules.find((m) => m.dimension === dimension)
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/unified-audit/modules/registry.test.ts`

Expected: 8 tests PASS.

**Step 5: Commit**

```bash
git add lib/unified-audit/modules/registry.ts tests/unit/lib/unified-audit/modules/registry.test.ts
git commit -m "feat: add audit module registry with SEO, Performance, AI Readiness"
```

---

## Task 7: Runner Refactor — Module Execution

This is the core refactor. The runner changes from hardcoded phase calls to a generic module executor.

**Files:**

- Modify: `lib/unified-audit/runner.ts`
- Create: `tests/unit/lib/unified-audit/runner/module-execution.test.ts`

**Step 1: Write the module execution tests**

Create `tests/unit/lib/unified-audit/runner/module-execution.test.ts`:

```typescript
import { describe, test, expect, vi } from 'vitest'
import { executeModules } from '@/lib/unified-audit/runner'
import { ScoreDimension, CheckStatus, CheckPriority } from '@/lib/enums'
import type { AuditModule, AuditCheck, PostCrawlResult } from '@/lib/unified-audit/types'

function makeCheck(dimension: ScoreDimension): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'crawlability' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status: CheckStatus.Passed,
    display_name: 'Test',
    display_name_passed: 'Test',
    description: 'Test',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [dimension],
    created_at: new Date().toISOString(),
  }
}

function makeMockModule(dimension: ScoreDimension, score: number, shouldFail = false): AuditModule {
  return {
    dimension,
    checks: [],
    calculateScore: () => score,
    runPostCrawlPhase: shouldFail
      ? async () => {
          throw new Error(`${dimension} phase failed`)
        }
      : undefined,
  }
}

describe('executeModules', () => {
  test('returns results for all modules', async () => {
    const modules = [
      makeMockModule(ScoreDimension.SEO, 85),
      makeMockModule(ScoreDimension.Performance, 70),
      makeMockModule(ScoreDimension.AIReadiness, 90),
    ]

    const results = await executeModules(modules, [])

    expect(results).toHaveLength(3)
    expect(results.find((r) => r.dimension === ScoreDimension.SEO)?.score).toBe(85)
    expect(results.find((r) => r.dimension === ScoreDimension.Performance)?.score).toBe(70)
    expect(results.find((r) => r.dimension === ScoreDimension.AIReadiness)?.score).toBe(90)
  })

  test('records timing for each module', async () => {
    const modules = [makeMockModule(ScoreDimension.SEO, 85)]
    const results = await executeModules(modules, [])

    expect(results[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  test('marks failed modules without blocking others', async () => {
    const modules = [
      makeMockModule(ScoreDimension.SEO, 85),
      makeMockModule(ScoreDimension.Performance, 70, true), // will fail
      makeMockModule(ScoreDimension.AIReadiness, 90),
    ]

    const results = await executeModules(modules, [])

    const seo = results.find((r) => r.dimension === ScoreDimension.SEO)!
    const perf = results.find((r) => r.dimension === ScoreDimension.Performance)!
    const ai = results.find((r) => r.dimension === ScoreDimension.AIReadiness)!

    expect(seo.status).toBe('completed')
    expect(perf.status).toBe('failed')
    expect(perf.error).toBeDefined()
    expect(ai.status).toBe('completed')
  })

  test('filters checks by dimension for scoring', async () => {
    const seoCheck = makeCheck(ScoreDimension.SEO)
    const perfCheck = makeCheck(ScoreDimension.Performance)

    const scoreFn = vi.fn().mockReturnValue(75)
    const modules: AuditModule[] = [
      {
        dimension: ScoreDimension.SEO,
        checks: [],
        calculateScore: scoreFn,
      },
    ]

    await executeModules(modules, [seoCheck, perfCheck])

    // Should only pass SEO checks to SEO module's scoring
    expect(scoreFn).toHaveBeenCalledWith(expect.arrayContaining([seoCheck]), undefined)
    expect(scoreFn).toHaveBeenCalledWith(expect.not.arrayContaining([perfCheck]), undefined)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/unified-audit/runner/module-execution.test.ts`

Expected: FAIL — `executeModules` doesn't exist yet.

**Step 3: Add `executeModules` function to `runner.ts`**

Add this new exported function to `lib/unified-audit/runner.ts`. This is the core module executor that will replace the hardcoded phase calls. Add it after the imports section:

```typescript
import { auditModules } from './modules/registry'
import type {
  AuditModule,
  ModuleStatus,
  ModuleError,
  PostCrawlContext,
  PostCrawlResult,
} from './types'
```

Add the new types and function (add after the `buildCheckRecord` export, before the `runUnifiedAudit` function):

```typescript
// =============================================================================
// Module Execution Engine
// =============================================================================

export interface ModuleResult {
  dimension: ScoreDimension
  score: number | null
  status: ModuleStatus
  durationMs: number
  error?: ModuleError
  phaseResult?: PostCrawlResult
}

/**
 * Execute audit modules in parallel.
 * Each module: filter checks by dimension → run post-crawl phase → calculate score.
 * Module failures are isolated — one module crashing never takes down the others.
 */
export async function executeModules(
  modules: AuditModule[],
  allCheckResults: AuditCheck[],
  postCrawlContext?: PostCrawlContext
): Promise<ModuleResult[]> {
  const results = await Promise.allSettled(
    modules.map(async (mod): Promise<ModuleResult> => {
      const startTime = Date.now()
      try {
        // Run post-crawl phase if defined
        let phaseResult: PostCrawlResult | undefined
        if (mod.runPostCrawlPhase && postCrawlContext) {
          try {
            phaseResult = await mod.runPostCrawlPhase(postCrawlContext)
          } catch (phaseError) {
            console.error('[Unified Audit]', {
              type: 'module_phase_failed',
              module: mod.dimension,
              phase: 'post_crawl',
              error: phaseError instanceof Error ? phaseError.message : String(phaseError),
              timestamp: new Date().toISOString(),
            })
            // Continue with checks-only scoring (no phase result)
          }
        }

        // Filter checks for this dimension and calculate score
        const dimensionChecks = allCheckResults.filter((c) =>
          c.feeds_scores.includes(mod.dimension)
        )
        const score = mod.calculateScore(dimensionChecks, phaseResult)

        return {
          dimension: mod.dimension,
          score,
          status: 'completed' as ModuleStatus,
          durationMs: Date.now() - startTime,
          phaseResult,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Unified Audit]', {
          type: 'module_failed',
          module: mod.dimension,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        })
        return {
          dimension: mod.dimension,
          score: null,
          status: 'failed' as ModuleStatus,
          durationMs: Date.now() - startTime,
          error: {
            phase: 'scoring',
            message: errorMessage,
            timestamp: new Date().toISOString(),
          },
        }
      }
    })
  )

  return results.map((r) => {
    if (r.status === 'fulfilled') return r.value
    // This shouldn't happen since we catch inside, but handle gracefully
    return {
      dimension: ScoreDimension.SEO, // fallback
      score: null,
      status: 'failed' as ModuleStatus,
      durationMs: 0,
      error: {
        phase: 'scoring' as const,
        message: r.reason instanceof Error ? r.reason.message : String(r.reason),
        timestamp: new Date().toISOString(),
      },
    }
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/unified-audit/runner/module-execution.test.ts`

Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add lib/unified-audit/runner.ts tests/unit/lib/unified-audit/runner/
git commit -m "feat: add executeModules parallel module executor"
```

---

## Task 8: Runner Refactor — Wire Modules into Audit Flow

Now replace the hardcoded scoring/analysis calls in `runner.ts` with the module system.

**Files:**

- Modify: `lib/unified-audit/runner.ts`

**Step 1: Refactor `completeAuditScoring` to use modules**

Replace the existing `completeAuditScoring` function in `runner.ts` with:

```typescript
async function completeAuditScoring(
  auditId: string,
  url: string,
  allPages: AuditPage[],
  allCheckResults: AuditCheck[],
  sampleSize: number,
  aiAnalysisEnabled: boolean,
  organizationId: string | null
): Promise<void> {
  const supabase = createServiceClient()

  // Set status to Analyzing
  await supabase.from('audits').update({ status: UnifiedAuditStatus.Analyzing }).eq('id', auditId)

  const postCrawlContext: PostCrawlContext = {
    auditId,
    url,
    allPages,
    sampleSize,
    organizationId,
  }

  // Execute all modules in parallel
  const moduleResults = await executeModules(auditModules, allCheckResults, postCrawlContext)

  // If PSI upserted checks, re-fetch from DB for accurate counts
  const perfResult = moduleResults.find((r) => r.dimension === ScoreDimension.Performance)
  const psiUpserted = (perfResult?.phaseResult?.checksUpserted as number) ?? 0
  let finalChecks = allCheckResults
  if (psiUpserted > 0) {
    const { data: freshChecks } = await supabase
      .from('audit_checks')
      .select(AUDIT_CHECK_SELECT)
      .eq('audit_id', auditId)
    if (freshChecks) {
      finalChecks = freshChecks as AuditCheck[]
    }
  }

  // Build module metadata
  const moduleTimings: Record<string, number> = {}
  const moduleStatuses: Record<string, ModuleStatus> = {}
  const moduleErrors: Record<string, ModuleError> = {}

  for (const result of moduleResults) {
    moduleTimings[result.dimension] = result.durationMs
    moduleStatuses[result.dimension] = result.status
    if (result.error) {
      moduleErrors[result.dimension] = result.error
    }
  }

  // Calculate scores from module results
  const seoResult = moduleResults.find((r) => r.dimension === ScoreDimension.SEO)
  const perfScoreResult = moduleResults.find((r) => r.dimension === ScoreDimension.Performance)
  const aiResult = moduleResults.find((r) => r.dimension === ScoreDimension.AIReadiness)

  const seoScore = seoResult?.score ?? null
  const performanceScore = perfScoreResult?.score ?? null
  const aiReadinessScore = aiResult?.score ?? null

  // Calculate overall score from completed modules only
  const overallScore = calculatePartialOverallScore(moduleResults)

  // Determine audit status
  const completedCount = moduleResults.filter((r) => r.status === 'completed').length
  const failedCount = moduleResults.filter((r) => r.status === 'failed').length
  let auditStatus: UnifiedAuditStatus
  if (failedCount === moduleResults.length) {
    auditStatus = UnifiedAuditStatus.Failed
  } else if (failedCount > 0) {
    auditStatus = UnifiedAuditStatus.CompletedWithErrors
  } else {
    auditStatus = UnifiedAuditStatus.Completed
  }

  // Count check results
  const failedChecks = finalChecks.filter((c) => c.status === CheckStatus.Failed).length
  const warningChecks = finalChecks.filter((c) => c.status === CheckStatus.Warning).length
  const passedChecks = finalChecks.filter((c) => c.status === CheckStatus.Passed).length

  await supabase
    .from('audits')
    .update({
      status: auditStatus,
      overall_score: overallScore,
      seo_score: seoScore,
      performance_score: performanceScore,
      ai_readiness_score: aiReadinessScore,
      failed_count: failedChecks,
      warning_count: warningChecks,
      passed_count: passedChecks,
      module_timings: moduleTimings,
      module_statuses: moduleStatuses,
      module_errors: moduleErrors,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  console.log(
    `[Unified Audit] Audit ${auditId} ${auditStatus}. SEO=${seoScore}, Performance=${performanceScore}, AI=${aiReadinessScore}, Overall=${overallScore}`
  )
}
```

**Step 2: Add `calculatePartialOverallScore` helper**

Add this function near the top of `runner.ts` (after imports):

```typescript
/**
 * Calculate overall score from completed module results.
 * Re-weights proportionally when some modules have failed.
 */
function calculatePartialOverallScore(moduleResults: ModuleResult[]): number | null {
  const completed = moduleResults.filter((r) => r.status === 'completed' && r.score !== null)
  if (completed.length === 0) return null

  const weightMap: Record<string, number> = {
    [ScoreDimension.SEO]: DEFAULT_SCORE_WEIGHTS.seo,
    [ScoreDimension.Performance]: DEFAULT_SCORE_WEIGHTS.performance,
    [ScoreDimension.AIReadiness]: DEFAULT_SCORE_WEIGHTS.ai_readiness,
  }

  let totalWeight = 0
  let weightedSum = 0

  for (const result of completed) {
    const weight = weightMap[result.dimension] ?? 0
    totalWeight += weight
    weightedSum += result.score! * weight
  }

  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}
```

**Step 3: Update callers of `completeAuditScoring`**

The function signature changed — it now needs `sampleSize`, `aiAnalysisEnabled`, and `organizationId` instead of `strategicScore`. Update the calls in `runUnifiedAudit` and `finishUnifiedAudit`:

In `runUnifiedAudit`, replace the Phase 3 (PSI + AI) and Phase 4 (Scoring) sections with:

```typescript
// Phase 3+4: Module execution (parallel) + Scoring
await completeAuditScoring(
  auditId,
  url,
  allPages,
  allCheckResults,
  audit.sample_size ?? 5,
  audit.ai_analysis_enabled ?? true,
  audit.organization_id
)
```

Remove the `runAnalysisPhase` call and the old `completeAuditScoring` call. Also remove the `runAnalysisPhase` function entirely (it's replaced by the module system).

For the early exit when `crawlStopped` is true, update:

```typescript
if (crawlStopped) {
  await completeAuditScoring(
    auditId,
    url,
    allPages,
    allCheckResults,
    audit.sample_size ?? 5,
    false,
    audit.organization_id
  )
  return
}
```

In `finishUnifiedAudit`, replace the analysis and scoring sections at the end with:

```typescript
// Module execution + Scoring
await completeAuditScoring(
  auditId,
  url,
  allPages,
  allCheckResults,
  auditConfig?.sample_size ?? 5,
  wasStopped ? false : (auditConfig?.ai_analysis_enabled ?? true),
  audit?.organization_id ?? null
)
```

Fetch the `organization_id` in the `finishUnifiedAudit` function by updating the audit query:

```typescript
const { data: audit } = await supabase
  .from('audits')
  .select('organization_id, sample_size, ai_analysis_enabled')
  .eq('id', auditId)
  .single()
```

**Step 4: Clean up unused imports**

Remove these now-unused imports from `runner.ts`:

- `calculateSEOScore`, `calculatePerformanceScore`, `calculateAIReadinessScore`, `calculateOverallScore` from `./scoring`
- `runPSIAnalysis` from `./psi-runner`
- `runAIAnalysisPhase` from `./ai-runner`

Add these new imports:

- `auditModules` from `./modules/registry`
- `type { PostCrawlContext, ModuleStatus, ModuleError }` from `./types`
- `{ DEFAULT_SCORE_WEIGHTS }` from `./types`

**Step 5: Run all existing tests**

Run: `npx vitest run tests/unit/lib/unified-audit/`

Expected: All tests pass (existing check tests are unaffected).

**Step 6: Run lint and build**

Run: `npm run lint && npm run build`

Expected: Clean.

**Step 7: Commit**

```bash
git add lib/unified-audit/runner.ts
git commit -m "refactor: wire module system into audit runner, replace hardcoded scoring"
```

---

## Task 9: Overall Score Tests

**Files:**

- Create: `tests/unit/lib/unified-audit/runner/overall-score.test.ts`

**Step 1: Write overall score tests**

Create `tests/unit/lib/unified-audit/runner/overall-score.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'

// We test the calculatePartialOverallScore logic indirectly through executeModules
// since calculatePartialOverallScore is not exported.
// Instead, test the blending logic directly.
import { ScoreDimension } from '@/lib/enums'
import { DEFAULT_SCORE_WEIGHTS } from '@/lib/unified-audit/types'
import type { ModuleStatus } from '@/lib/unified-audit/types'

interface ModuleScoreInput {
  dimension: ScoreDimension
  score: number | null
  status: ModuleStatus
}

/**
 * Pure re-implementation of the partial overall score logic for testing.
 * This mirrors calculatePartialOverallScore in runner.ts.
 */
function calculatePartialOverallScore(results: ModuleScoreInput[]): number | null {
  const completed = results.filter((r) => r.status === 'completed' && r.score !== null)
  if (completed.length === 0) return null

  const weightMap: Record<string, number> = {
    [ScoreDimension.SEO]: DEFAULT_SCORE_WEIGHTS.seo,
    [ScoreDimension.Performance]: DEFAULT_SCORE_WEIGHTS.performance,
    [ScoreDimension.AIReadiness]: DEFAULT_SCORE_WEIGHTS.ai_readiness,
  }

  let totalWeight = 0
  let weightedSum = 0

  for (const result of completed) {
    const weight = weightMap[result.dimension] ?? 0
    totalWeight += weight
    weightedSum += result.score! * weight
  }

  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

describe('calculatePartialOverallScore', () => {
  test('blends all 3 modules with default weights (0.4, 0.3, 0.3)', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 80, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: 70, status: 'completed' },
      { dimension: ScoreDimension.AIReadiness, score: 90, status: 'completed' },
    ]
    // 80*0.4 + 70*0.3 + 90*0.3 = 32 + 21 + 27 = 80
    expect(calculatePartialOverallScore(results)).toBe(80)
  })

  test('re-weights when one module fails', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 80, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: null, status: 'failed' },
      { dimension: ScoreDimension.AIReadiness, score: 60, status: 'completed' },
    ]
    // Only SEO (0.4) and AI (0.3) completed. Total weight = 0.7
    // (80*0.4 + 60*0.3) / 0.7 = (32+18) / 0.7 = 50/0.7 ≈ 71
    expect(calculatePartialOverallScore(results)).toBe(71)
  })

  test('returns null when all modules fail', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: null, status: 'failed' },
      { dimension: ScoreDimension.Performance, score: null, status: 'failed' },
      { dimension: ScoreDimension.AIReadiness, score: null, status: 'failed' },
    ]
    expect(calculatePartialOverallScore(results)).toBeNull()
  })

  test('returns score when only one module completes', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 75, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: null, status: 'failed' },
      { dimension: ScoreDimension.AIReadiness, score: null, status: 'failed' },
    ]
    // Only SEO: 75*0.4 / 0.4 = 75
    expect(calculatePartialOverallScore(results)).toBe(75)
  })

  test('handles perfect scores', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 100, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: 100, status: 'completed' },
      { dimension: ScoreDimension.AIReadiness, score: 100, status: 'completed' },
    ]
    expect(calculatePartialOverallScore(results)).toBe(100)
  })

  test('handles zero scores', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 0, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: 0, status: 'completed' },
      { dimension: ScoreDimension.AIReadiness, score: 0, status: 'completed' },
    ]
    expect(calculatePartialOverallScore(results)).toBe(0)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/lib/unified-audit/runner/overall-score.test.ts`

Expected: 6 tests PASS.

**Step 3: Commit**

```bash
git add tests/unit/lib/unified-audit/runner/overall-score.test.ts
git commit -m "test: add overall score blending tests for partial module completion"
```

---

## Task 10: Rerun Module Server Action

**Files:**

- Modify: `app/(authenticated)/[orgId]/seo/audit/[id]/actions.ts`
- Create: `tests/unit/lib/unified-audit/runner/rerun-module.test.ts`

**Step 1: Write the rerun test**

Create `tests/unit/lib/unified-audit/runner/rerun-module.test.ts`:

```typescript
import { describe, test, expect, vi } from 'vitest'
import { ScoreDimension, CheckStatus, CheckPriority } from '@/lib/enums'
import type { AuditCheck, AuditModule, PostCrawlResult } from '@/lib/unified-audit/types'
import { executeModules } from '@/lib/unified-audit/runner'

function makeCheck(
  dimension: ScoreDimension,
  status: CheckStatus = CheckStatus.Passed
): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'crawlability' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status,
    display_name: 'Test',
    display_name_passed: 'Test',
    description: 'Test',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [dimension],
    created_at: new Date().toISOString(),
  }
}

describe('rerun single module via executeModules', () => {
  test('can execute a single module independently', async () => {
    const scoreFn = vi.fn().mockReturnValue(85)
    const singleModule: AuditModule[] = [
      {
        dimension: ScoreDimension.AIReadiness,
        checks: [],
        calculateScore: scoreFn,
      },
    ]

    const checks = [
      makeCheck(ScoreDimension.AIReadiness, CheckStatus.Passed),
      makeCheck(ScoreDimension.SEO, CheckStatus.Failed), // should be filtered out
    ]

    const results = await executeModules(singleModule, checks)

    expect(results).toHaveLength(1)
    expect(results[0].dimension).toBe(ScoreDimension.AIReadiness)
    expect(results[0].score).toBe(85)

    // Verify only AI Readiness checks were passed to scoring
    const passedChecks = scoreFn.mock.calls[0][0] as AuditCheck[]
    expect(passedChecks).toHaveLength(1)
    expect(passedChecks[0].feeds_scores).toContain(ScoreDimension.AIReadiness)
  })

  test('post-crawl phase failure falls back to programmatic scoring', async () => {
    const singleModule: AuditModule[] = [
      {
        dimension: ScoreDimension.AIReadiness,
        checks: [],
        runPostCrawlPhase: async () => {
          throw new Error('Claude API down')
        },
        calculateScore: (checks, phaseResult) => {
          // Should receive undefined phaseResult on failure
          return phaseResult ? 50 : 100
        },
      },
    ]

    const results = await executeModules(singleModule, [])

    expect(results[0].status).toBe('completed')
    expect(results[0].score).toBe(100) // 100% programmatic fallback
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/unified-audit/runner/rerun-module.test.ts`

Expected: 2 tests PASS (executeModules already supports this).

**Step 3: Add the `rerunModule` server action**

In `app/(authenticated)/[orgId]/seo/audit/[id]/actions.ts`, add this new exported function after the existing `rerunCheck` function. First add the necessary imports at the top of the file:

```typescript
import { getModule } from '@/lib/unified-audit/modules/registry'
import { executeModules } from '@/lib/unified-audit/runner'
import { ScoreDimension } from '@/lib/enums'
import type { PostCrawlContext } from '@/lib/unified-audit/types'
```

Then add the action:

```typescript
export async function rerunModule(
  auditId: string,
  dimension: ScoreDimension
): Promise<{ success: boolean; error?: string }> {
  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()
  const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = rawUser
    ? {
        organization_id: membership?.organization_id ?? null,
        role: membership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null
  if (!userRecord) return { success: false, error: 'User not found' }

  // Verify audit access
  const serviceClient = createServiceClient()
  const { data: audit } = await serviceClient
    .from('audits')
    .select('id, organization_id, created_by, url, sample_size, ai_analysis_enabled')
    .eq('id', auditId)
    .single()
  if (!audit) return { success: false, error: 'Audit not found' }

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)
  if (!hasAccess) return { success: false, error: 'Access denied' }

  // Find the module
  const mod = getModule(dimension)
  if (!mod) return { success: false, error: 'Module not found' }

  // Get all crawled pages
  const { data: pages } = await serviceClient
    .from('audit_pages')
    .select('*')
    .eq('audit_id', auditId)
  if (!pages?.length) return { success: false, error: 'No pages found for audit' }

  // Delete existing checks for this dimension
  const dimensionCheckNames = mod.checks.map((c) => c.name)
  if (dimensionCheckNames.length > 0) {
    await serviceClient
      .from('audit_checks')
      .delete()
      .eq('audit_id', auditId)
      .in('check_name', dimensionCheckNames)
  }

  // Delete existing AI analyses if re-running AI Readiness
  if (dimension === ScoreDimension.AIReadiness) {
    await serviceClient.from('audit_ai_analyses').delete().eq('audit_id', auditId)
  }

  // Re-run page-specific checks for this module
  const { fetchPage } = await import('@/lib/audit/fetcher')
  const { buildCheckRecord } = await import('@/lib/unified-audit/runner')
  const { siteWideChecks: allSiteWideChecks } = await import('@/lib/unified-audit/checks')

  const pageSpecific = mod.checks.filter((c) => !c.isSiteWide)
  const siteWide = mod.checks.filter((c) => c.isSiteWide)
  const newChecks: AuditCheck[] = []

  // Page-specific checks
  const htmlPages = pages.filter(
    (p: { is_resource: boolean; status_code: number | null }) =>
      !p.is_resource && (!p.status_code || p.status_code < 400)
  )

  for (const page of htmlPages) {
    try {
      const { html, error } = await fetchPage(page.url)
      if (error || !html) continue

      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title ?? undefined,
        statusCode: page.status_code ?? 200,
        allPages: pages.map((p: AuditPage) => ({
          url: p.url,
          title: p.title,
          statusCode: p.status_code,
          metaDescription: p.meta_description,
          isResource: p.is_resource,
        })),
      }

      for (const check of pageSpecific) {
        try {
          const result = await check.run(context)
          newChecks.push(buildCheckRecord(auditId, page.url, check, result))
        } catch {
          // Continue on individual check failure
        }
      }
    } catch {
      // Continue on page fetch failure
    }
  }

  // Site-wide checks
  if (siteWide.length > 0 && htmlPages.length > 0) {
    const homepage =
      htmlPages.find((p: AuditPage) => {
        const pageUrl = new URL(p.url)
        return pageUrl.pathname === '/' || pageUrl.pathname === ''
      }) || htmlPages[0]

    const { html } = await fetchPage(homepage.url)
    if (html) {
      const context: CheckContext = {
        url: homepage.url,
        html,
        title: homepage.title ?? undefined,
        statusCode: homepage.status_code ?? 200,
        allPages: pages.map((p: AuditPage) => ({
          url: p.url,
          title: p.title,
          statusCode: p.status_code,
          metaDescription: p.meta_description,
          isResource: p.is_resource,
        })),
      }

      for (const check of siteWide) {
        try {
          const result = await check.run(context)
          newChecks.push(buildCheckRecord(auditId, null, check, result))
        } catch {
          // Continue
        }
      }
    }
  }

  // Insert new checks
  if (newChecks.length > 0) {
    await serviceClient.from('audit_checks').insert(newChecks)
  }

  // Run post-crawl phase and calculate score
  const postCrawlContext: PostCrawlContext = {
    auditId,
    url: audit.url,
    allPages: pages as AuditPage[],
    sampleSize: audit.sample_size ?? 5,
    organizationId: audit.organization_id,
  }

  const moduleResults = await executeModules([mod], [...newChecks], postCrawlContext)
  const moduleResult = moduleResults[0]

  // Get all checks for recalculating overall score
  const { data: allChecks } = await serviceClient
    .from('audit_checks')
    .select('*')
    .eq('audit_id', auditId)

  // Update the dimension score and module metadata
  const scoreField =
    dimension === ScoreDimension.SEO
      ? 'seo_score'
      : dimension === ScoreDimension.Performance
        ? 'performance_score'
        : 'ai_readiness_score'

  // Get current module metadata
  const { data: currentAudit } = await serviceClient
    .from('audits')
    .select(
      'seo_score, performance_score, ai_readiness_score, module_timings, module_statuses, module_errors'
    )
    .eq('id', auditId)
    .single()

  const updatedTimings = {
    ...((currentAudit?.module_timings as Record<string, number>) ?? {}),
    [dimension]: moduleResult.durationMs,
  }
  const updatedStatuses = {
    ...((currentAudit?.module_statuses as Record<string, string>) ?? {}),
    [dimension]: moduleResult.status,
  }
  const updatedErrors = { ...((currentAudit?.module_errors as Record<string, unknown>) ?? {}) }
  if (moduleResult.error) {
    updatedErrors[dimension] = moduleResult.error
  } else {
    delete updatedErrors[dimension]
  }

  // Recalculate overall score
  const scores: Record<string, number | null> = {
    [ScoreDimension.SEO]: currentAudit?.seo_score ?? null,
    [ScoreDimension.Performance]: currentAudit?.performance_score ?? null,
    [ScoreDimension.AIReadiness]: currentAudit?.ai_readiness_score ?? null,
  }
  scores[dimension] = moduleResult.score

  const { calculateOverallScore } = await import('@/lib/unified-audit/scoring')
  const overallScore = calculateOverallScore(
    scores[ScoreDimension.SEO],
    scores[ScoreDimension.Performance],
    scores[ScoreDimension.AIReadiness]
  )

  await serviceClient
    .from('audits')
    .update({
      [scoreField]: moduleResult.score,
      overall_score: overallScore,
      module_timings: updatedTimings,
      module_statuses: updatedStatuses,
      module_errors: updatedErrors,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  revalidatePath(`/seo/audit/${auditId}`)

  return { success: true }
}
```

Also ensure the necessary imports are present at the top of the file:

```typescript
import type { AuditPage, AuditCheck, CheckContext } from '@/lib/unified-audit/types'
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/lib/unified-audit/runner/rerun-module.test.ts`

Expected: PASS.

**Step 5: Run lint and build**

Run: `npm run lint && npm run build`

**Step 6: Commit**

```bash
git add app/(authenticated)/[orgId]/seo/audit/[id]/actions.ts tests/unit/lib/unified-audit/runner/rerun-module.test.ts
git commit -m "feat: add rerunModule server action for re-running individual audit modules"
```

---

## Task 11: Error Handling Tests

**Files:**

- Create: `tests/unit/lib/unified-audit/runner/error-handling.test.ts`

**Step 1: Write error handling tests**

Create `tests/unit/lib/unified-audit/runner/error-handling.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { executeModules } from '@/lib/unified-audit/runner'
import { ScoreDimension, CheckStatus, CheckPriority } from '@/lib/enums'
import type { AuditModule, AuditCheck, PostCrawlContext } from '@/lib/unified-audit/types'

const mockPostCrawlContext: PostCrawlContext = {
  auditId: 'test',
  url: 'https://example.com',
  allPages: [],
  sampleSize: 5,
  organizationId: null,
}

function makeModule(
  dimension: ScoreDimension,
  opts: { score?: number; phaseThrows?: boolean; scoreThrows?: boolean } = {}
): AuditModule {
  return {
    dimension,
    checks: [],
    runPostCrawlPhase: opts.phaseThrows
      ? async () => {
          throw new Error(`${dimension} phase error`)
        }
      : undefined,
    calculateScore: opts.scoreThrows
      ? () => {
          throw new Error(`${dimension} scoring error`)
        }
      : () => opts.score ?? 80,
  }
}

describe('module error handling', () => {
  test('post-crawl phase failure does not mark module as failed', async () => {
    const modules = [makeModule(ScoreDimension.AIReadiness, { phaseThrows: true, score: 75 })]
    const results = await executeModules(modules, [], mockPostCrawlContext)

    // Module should still complete with programmatic-only score
    expect(results[0].status).toBe('completed')
    expect(results[0].score).toBe(75)
  })

  test('scoring failure marks module as failed', async () => {
    const modules = [makeModule(ScoreDimension.SEO, { scoreThrows: true })]
    const results = await executeModules(modules, [])

    expect(results[0].status).toBe('failed')
    expect(results[0].score).toBeNull()
    expect(results[0].error).toBeDefined()
    expect(results[0].error!.phase).toBe('scoring')
  })

  test('one module failure does not affect others', async () => {
    const modules = [
      makeModule(ScoreDimension.SEO, { score: 80 }),
      makeModule(ScoreDimension.Performance, { scoreThrows: true }),
      makeModule(ScoreDimension.AIReadiness, { score: 90 }),
    ]

    const results = await executeModules(modules, [])

    expect(results.find((r) => r.dimension === ScoreDimension.SEO)!.status).toBe('completed')
    expect(results.find((r) => r.dimension === ScoreDimension.Performance)!.status).toBe('failed')
    expect(results.find((r) => r.dimension === ScoreDimension.AIReadiness)!.status).toBe(
      'completed'
    )
  })

  test('error includes timestamp and phase', async () => {
    const modules = [makeModule(ScoreDimension.SEO, { scoreThrows: true })]
    const results = await executeModules(modules, [])

    expect(results[0].error!.timestamp).toBeDefined()
    expect(results[0].error!.phase).toBe('scoring')
    expect(results[0].error!.message).toContain('scoring error')
  })

  test('all modules failing returns all failed results', async () => {
    const modules = [
      makeModule(ScoreDimension.SEO, { scoreThrows: true }),
      makeModule(ScoreDimension.Performance, { scoreThrows: true }),
      makeModule(ScoreDimension.AIReadiness, { scoreThrows: true }),
    ]

    const results = await executeModules(modules, [])

    expect(results.every((r) => r.status === 'failed')).toBe(true)
    expect(results.every((r) => r.score === null)).toBe(true)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/lib/unified-audit/runner/error-handling.test.ts`

Expected: 5 tests PASS.

**Step 3: Commit**

```bash
git add tests/unit/lib/unified-audit/runner/error-handling.test.ts
git commit -m "test: add module error handling and isolation tests"
```

---

## Task 12: UI — Retry Button and Partial Score Tooltip

**Files:**

- Modify: `components/audit/unified-score-cards.tsx` — Add partial score tooltip
- Modify: `app/(authenticated)/[orgId]/seo/audit/[id]/client.tsx` — Add retry button for failed modules

**Step 1: Read the current score cards component**

Read `components/audit/unified-score-cards.tsx` to understand the current implementation before modifying.

**Step 2: Add partial score tooltip to score cards**

Modify `components/audit/unified-score-cards.tsx` to accept `moduleStatuses` and `moduleErrors` props. When the overall score card is rendered and some modules have failed:

- Show a warning icon (AlertTriangle from lucide-react) next to the overall score
- Add a tooltip that says: "This score only reflects [completed modules]. [Failed modules] encountered errors and are not included. Re-run failed modules for a complete score."
- When all modules failed, show "All modules encountered errors. No score available." in the tooltip

The tooltip should use the existing `Tooltip` component from shadcn (`components/ui/tooltip.tsx`).

Props to add:

```typescript
interface UnifiedScoreCardsProps {
  // ... existing props
  moduleStatuses?: Record<string, string>
  moduleErrors?: Record<string, { phase: string; message: string; timestamp: string }>
}
```

**Step 3: Add retry button to failed module tabs**

In `app/(authenticated)/[orgId]/seo/audit/[id]/client.tsx`, when a module tab's status is `'failed'`:

- Show an `EmptyState` component (from `components/ui/empty-state.tsx`) with:
  - `AlertTriangle` icon
  - Title: "[Module Name] encountered an error"
  - Description: The error message from `moduleErrors[dimension]`
  - A "Retry" button that calls `rerunModule(auditId, dimension)`
- Use `useTransition` for the retry button pending state

Pass `moduleStatuses` and `moduleErrors` from the audit record to the client component.

**Step 4: Update the server page to pass module metadata**

In `app/(authenticated)/[orgId]/seo/audit/[id]/page.tsx`, ensure `module_statuses` and `module_errors` are included in the audit data passed to the client component. These should come from the audit record fetched on the server.

**Step 5: Run lint and build**

Run: `npm run lint && npm run build`

**Step 6: Commit**

```bash
git add components/audit/unified-score-cards.tsx app/(authenticated)/[orgId]/seo/audit/[id]/client.tsx app/(authenticated)/[orgId]/seo/audit/[id]/page.tsx
git commit -m "feat: add partial score tooltip and module retry button to audit results"
```

---

## Task 13: Update Scoring Module — Backwards Compatibility

The old `scoring.ts` functions are still imported by other parts of the codebase (e.g. the `rerunCheck` action recalculates scores). Keep `scoring.ts` but update `calculateAIReadinessScore` to use 50/50 blend.

**Files:**

- Modify: `lib/unified-audit/scoring.ts`

**Step 1: Update the AI Readiness blend ratio**

In `lib/unified-audit/scoring.ts`, change the `calculateAIReadinessScore` function:

```typescript
export function calculateAIReadinessScore(
  checks: AuditCheck[],
  strategicScore: number | null
): number {
  const programmaticScore = calculateCheckScore(
    checks.filter((c) => c.feeds_scores.includes(ScoreDimension.AIReadiness))
  )
  if (strategicScore === null) return programmaticScore
  return Math.round(programmaticScore * 0.5 + strategicScore * 0.5)
}
```

Change `0.4` to `0.5` and `0.6` to `0.5`.

**Step 2: Update `calculateOverallScore` to handle nulls for partial completion**

The existing function already returns `null` if any score is `null`. Update it to handle partial completion:

```typescript
export function calculateOverallScore(
  seo: number | null,
  performance: number | null,
  aiReadiness: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number | null {
  const scores: { value: number; weight: number }[] = []
  if (seo !== null) scores.push({ value: seo, weight: weights.seo })
  if (performance !== null) scores.push({ value: performance, weight: weights.performance })
  if (aiReadiness !== null) scores.push({ value: aiReadiness, weight: weights.ai_readiness })

  if (scores.length === 0) return null

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const weightedSum = scores.reduce((sum, s) => sum + s.value * s.weight, 0)

  return Math.round(weightedSum / totalWeight)
}
```

**Step 3: Run all unified audit tests**

Run: `npx vitest run tests/unit/lib/unified-audit/`

Expected: All pass.

**Step 4: Run build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add lib/unified-audit/scoring.ts
git commit -m "refactor: update scoring to 50/50 AI Readiness blend and partial overall score"
```

---

## Task 14: Clean Up Old Files

**Files:**

- Modify: `lib/unified-audit/psi-runner.ts` — Re-export from new location
- Modify: `lib/unified-audit/ai-runner.ts` — Re-export from new location

**Step 1: Make old files re-export from new locations**

Replace `lib/unified-audit/psi-runner.ts` with:

```typescript
/**
 * @deprecated Use `lib/unified-audit/modules/performance/psi-phase.ts` instead.
 * This file re-exports for backwards compatibility.
 */
export { runPSIPhase as runPSIAnalysis } from './modules/performance/psi-phase'
export type { PSIRunnerResult } from './modules/performance/psi-phase'
```

Wait — check if `psi-runner.ts` is still imported anywhere first.

Run: `grep -rn "psi-runner\|from.*psi-runner" lib/ app/ components/ --include="*.ts" --include="*.tsx"`

If nothing imports it (since runner.ts no longer does), delete it entirely. Same for `ai-runner.ts`.

Run: `grep -rn "ai-runner\|from.*ai-runner" lib/ app/ components/ --include="*.ts" --include="*.tsx"`

If nothing imports them, delete both files.

**Step 2: Delete the standalone AIO system**

```bash
rm -rf lib/aio/
rm -rf components/aio/
rm -rf tests/unit/lib/aio/
```

Wait — the AI analysis phase (in `modules/ai-readiness/ai-phase.ts`) still imports from `lib/aio/`:

- `selectTopPages` from `@/lib/aio/importance`
- `runAIAnalysis`, `calculateStrategicScore` from `@/lib/aio/ai-auditor`

These files must be preserved or moved. Check what files under `lib/aio/` are still needed:

- `lib/aio/importance.ts` — Page selection logic, used by both PSI and AI phases
- `lib/aio/ai-auditor.ts` — Claude API integration for strategic analysis

Move these to `lib/unified-audit/`:

```bash
mv lib/aio/importance.ts lib/unified-audit/importance.ts
mv lib/aio/ai-auditor.ts lib/unified-audit/ai-auditor.ts
```

Then update imports in:

- `lib/unified-audit/modules/ai-readiness/ai-phase.ts` — Change `@/lib/aio/importance` to `../../importance`, change `@/lib/aio/ai-auditor` to `../../ai-auditor`
- `lib/unified-audit/modules/performance/psi-phase.ts` — Change `@/lib/aio/importance` to `../../importance`

Check if `ai-auditor.ts` imports anything from `lib/aio/types.ts` — if so, move those types too.

Now delete the remaining AIO files:

```bash
rm -rf lib/aio/
```

**Step 3: Remove AIO navigation entry**

Check `components/navigation/child-sidebar.tsx` for any AIO-related nav items and remove them.

**Step 4: Remove AIO components**

```bash
rm -rf components/aio/
```

**Step 5: Remove AIO tests**

```bash
rm -rf tests/unit/lib/aio/
```

**Step 6: Run lint and build to verify nothing is broken**

Run: `npm run lint && npm run build`

Fix any broken imports.

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove standalone AIO system, move shared utilities to unified-audit"
```

---

## Task 15: Database Migration — Drop AIO Tables

**Files:**

- Create: `supabase/migrations/20260409130000_drop_aio_tables.sql`

**Step 1: Create migration**

```sql
-- Drop standalone AIO tables (replaced by unified audit modules)
DROP TABLE IF EXISTS aio_ai_analyses CASCADE;
DROP TABLE IF EXISTS aio_checks CASCADE;
DROP TABLE IF EXISTS aio_audits CASCADE;

-- Drop AIO-related types if they exist
DROP TYPE IF EXISTS aio_audit_status CASCADE;
```

**Step 2: Apply locally**

Run: `supabase db reset`

Verify tables are gone:

```bash
supabase db query "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'aio_%'"
```

Expected: Empty result.

**Step 3: Commit**

```bash
git add supabase/migrations/20260409130000_drop_aio_tables.sql
git commit -m "chore: drop standalone AIO database tables"
```

---

## Task 16: Update CLAUDE.md and Final Verification

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

Remove references to the legacy AIO system. In the "Legacy audit systems" note, update to indicate AIO has been fully removed:

Find the line:

> **Legacy audit systems** (`lib/audit/`, `lib/performance/`, `lib/aio/`) still exist in the codebase but are deprecated. All new audit work should use the unified system.

Replace with:

> **Legacy audit systems** (`lib/audit/`, `lib/performance/`) still exist in the codebase but are deprecated. The former `lib/aio/` system has been fully migrated into the unified audit's modular architecture. All new audit work should use the unified system.

**Step 2: Run full verification suite**

```bash
npm run lint && npx vitest run tests/unit/lib/unified-audit/ && npm run build
```

Expected: All clean.

**Step 3: Run all unit tests**

```bash
npm run test:unit
```

Expected: All pass.

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect AIO migration to unified audit modules"
```

**Step 5: Push**

```bash
git push
```
