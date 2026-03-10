# Unified Audit System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate three separate audit types into a single unified audit with 55 deduplicated checks across 10 categories, 3 score dimensions, new GEO features, and a tabbed UI.

**Architecture:** Clean break migration — new unified tables alongside existing ones. Single audit runner orchestrates crawl → parallel analysis (programmatic checks + PSI + Claude AI) → scoring. Checks organized by measurement domain, each contributing to one or more score dimensions (SEO 40%, Performance 30%, AI Readiness 30%).

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), Vitest, Shadcn UI + Tailwind CSS 4, Anthropic Claude API, Google PageSpeed Insights API.

**Design doc:** `docs/plans/2026-03-09-unified-audit-design.md`

---

## Milestone Checkpoints

Each milestone ends with:

```bash
npm run lint && npm run format:check && npm run test:unit && npm run build
```

Fix any failures before proceeding to the next milestone.

---

## Milestone 1: Database Schema & Core Types

### Task 1.1: Create Unified Audit Enums

**Files:**

- Modify: `lib/enums.ts`
- Test: `tests/unit/lib/enums.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/enums.test.ts - add to existing test file
import { UnifiedAuditStatus, CheckCategory, CrawlMode, ScoreDimension } from '@/lib/enums'

describe('Unified Audit Enums', () => {
  test('UnifiedAuditStatus has all required values', () => {
    expect(UnifiedAuditStatus.Pending).toBe('pending')
    expect(UnifiedAuditStatus.Crawling).toBe('crawling')
    expect(UnifiedAuditStatus.AwaitingConfirmation).toBe('awaiting_confirmation')
    expect(UnifiedAuditStatus.Checking).toBe('checking')
    expect(UnifiedAuditStatus.Completed).toBe('completed')
    expect(UnifiedAuditStatus.Failed).toBe('failed')
    expect(UnifiedAuditStatus.Stopped).toBe('stopped')
    expect(UnifiedAuditStatus.BatchComplete).toBe('batch_complete')
  })

  test('CheckCategory has all 10 categories', () => {
    expect(Object.values(CheckCategory)).toHaveLength(10)
    expect(CheckCategory.Crawlability).toBe('crawlability')
    expect(CheckCategory.MetaContent).toBe('meta_content')
    expect(CheckCategory.ContentStructure).toBe('content_structure')
    expect(CheckCategory.ContentQuality).toBe('content_quality')
    expect(CheckCategory.Links).toBe('links')
    expect(CheckCategory.Media).toBe('media')
    expect(CheckCategory.StructuredData).toBe('structured_data')
    expect(CheckCategory.Security).toBe('security')
    expect(CheckCategory.Performance).toBe('performance')
    expect(CheckCategory.AIVisibility).toBe('ai_visibility')
  })

  test('CrawlMode has standard and exhaustive', () => {
    expect(CrawlMode.Standard).toBe('standard')
    expect(CrawlMode.Exhaustive).toBe('exhaustive')
  })

  test('ScoreDimension has three dimensions', () => {
    expect(ScoreDimension.SEO).toBe('seo')
    expect(ScoreDimension.Performance).toBe('performance')
    expect(ScoreDimension.AIReadiness).toBe('ai_readiness')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/enums.test.ts -t "Unified Audit Enums" --run`
Expected: FAIL — enums not yet defined

**Step 3: Implement the enums**

Add to `lib/enums.ts`:

```typescript
export enum UnifiedAuditStatus {
  Pending = 'pending',
  Crawling = 'crawling',
  AwaitingConfirmation = 'awaiting_confirmation',
  Checking = 'checking',
  Completed = 'completed',
  Failed = 'failed',
  Stopped = 'stopped',
  BatchComplete = 'batch_complete',
}

export enum CheckCategory {
  Crawlability = 'crawlability',
  MetaContent = 'meta_content',
  ContentStructure = 'content_structure',
  ContentQuality = 'content_quality',
  Links = 'links',
  Media = 'media',
  StructuredData = 'structured_data',
  Security = 'security',
  Performance = 'performance',
  AIVisibility = 'ai_visibility',
}

export enum CrawlMode {
  Standard = 'standard',
  Exhaustive = 'exhaustive',
}

export enum ScoreDimension {
  SEO = 'seo',
  Performance = 'performance',
  AIReadiness = 'ai_readiness',
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest tests/unit/lib/enums.test.ts -t "Unified Audit Enums" --run`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/enums.ts tests/unit/lib/enums.test.ts
git commit -m "feat(audit): add unified audit enums — status, category, crawl mode, score dimension"
```

---

### Task 1.2: Create Unified Audit Type Definitions

**Files:**

- Create: `lib/unified-audit/types.ts`
- Test: `tests/unit/lib/unified-audit/types.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/unified-audit/types.test.ts
import type {
  UnifiedAudit,
  AuditPage,
  AuditCheck,
  AuditAIAnalysis,
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  PlatformReadiness,
  CitabilityDetails,
  BrandMentionDetails,
  AICrawlerBreakdown,
  LlmsTxtValidation,
  OrganizationSchemaDetails,
  SpeakableSchemaDetails,
  SchemaValidationDetails,
  ScoreWeights,
} from '@/lib/unified-audit/types'
import {
  UnifiedAuditStatus,
  CheckCategory,
  CheckPriority,
  CheckStatus,
  CrawlMode,
  ScoreDimension,
} from '@/lib/enums'

describe('Unified Audit Types', () => {
  test('UnifiedAudit interface has required fields', () => {
    const audit: UnifiedAudit = {
      id: 'test-id',
      organization_id: null,
      created_by: 'user-id',
      domain: 'example.com',
      url: 'https://example.com',
      status: UnifiedAuditStatus.Pending,
      seo_score: null,
      performance_score: null,
      ai_readiness_score: null,
      overall_score: null,
      pages_crawled: 0,
      crawl_mode: CrawlMode.Standard,
      max_pages: 50,
      soft_cap_reached: false,
      passed_count: 0,
      warning_count: 0,
      failed_count: 0,
      ai_analysis_enabled: true,
      sample_size: 5,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost: 0,
      use_relaxed_ssl: false,
      executive_summary: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(audit.status).toBe(UnifiedAuditStatus.Pending)
    expect(audit.crawl_mode).toBe(CrawlMode.Standard)
  })

  test('AuditCheck interface has feeds_scores array', () => {
    const check: AuditCheck = {
      id: 'check-id',
      audit_id: 'audit-id',
      page_url: null,
      category: CheckCategory.Crawlability,
      check_name: 'robots-txt-validation',
      priority: CheckPriority.Critical,
      status: CheckStatus.Passed,
      display_name: 'Missing robots.txt',
      display_name_passed: 'robots.txt found',
      description: 'Validates robots.txt',
      fix_guidance: null,
      learn_more_url: null,
      details: null,
      feeds_scores: [ScoreDimension.SEO],
      created_at: new Date().toISOString(),
    }
    expect(check.feeds_scores).toContain(ScoreDimension.SEO)
  })

  test('DEFAULT_SCORE_WEIGHTS sums to 1', () => {
    const weights: ScoreWeights = { seo: 0.4, performance: 0.3, ai_readiness: 0.3 }
    expect(weights.seo + weights.performance + weights.ai_readiness).toBeCloseTo(1)
  })

  test('AuditCheckDefinition has category and feeds_scores', () => {
    const def: AuditCheckDefinition = {
      name: 'test-check',
      category: CheckCategory.Crawlability,
      priority: CheckPriority.Critical,
      description: 'Test check',
      displayName: 'Test failed',
      displayNamePassed: 'Test passed',
      learnMoreUrl: 'https://example.com',
      isSiteWide: false,
      fixGuidance: 'Fix it',
      feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],
      run: async () => ({ status: CheckStatus.Passed }),
    }
    expect(def.feedsScores).toHaveLength(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/unified-audit/types.test.ts --run`
Expected: FAIL — module not found

**Step 3: Implement the types**

Create `lib/unified-audit/types.ts` with all interfaces from the design doc. Key differences from existing types:

- `AuditCheck` has `category: CheckCategory` (not `check_type: CheckType`)
- `AuditCheck` has `feeds_scores: ScoreDimension[]`
- `AuditCheckDefinition` has `category: CheckCategory` and `feedsScores: ScoreDimension[]`
- `UnifiedAudit` has `crawl_mode`, `soft_cap_reached`, all three score fields, `executive_summary`, `error_message`
- All new detail interfaces: `AICrawlerBreakdown`, `LlmsTxtValidation`, `OrganizationSchemaDetails`, `SpeakableSchemaDetails`, `SchemaValidationDetails`, `CitabilityDetails`, `BrandMentionDetails`, `PlatformReadiness`
- `DEFAULT_SCORE_WEIGHTS: ScoreWeights = { seo: 0.4, performance: 0.3, ai_readiness: 0.3 }`

Reference existing types for patterns:

- `lib/audit/types.ts` — SiteAudit, SiteAuditCheck, AuditCheckDefinition, CheckContext, CheckResult
- `lib/aio/types.ts` — AIOAudit, AIOCheck, AIOAIAnalysis, AIOCheckDefinition
- `lib/performance/types.ts` — PerformanceAudit, PerformanceAuditResult

**Step 4: Run test to verify it passes**

Run: `npx vitest tests/unit/lib/unified-audit/types.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/unified-audit/types.ts tests/unit/lib/unified-audit/types.test.ts
git commit -m "feat(audit): add unified audit type definitions with all check detail interfaces"
```

---

### Task 1.3: Create Database Migration

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_create_unified_audit_tables.sql`

**Step 1: Write the migration**

Create the migration file with:

1. **Create `unified_audit_status` enum** with all 8 values
2. **Create `audits` table** — all columns from design doc, with FK to organizations and auth.users
3. **Create `audit_pages` table** — with FK cascade delete to audits
4. **Create `audit_checks` table** — with `category` text, `feeds_scores` text[], FK cascade delete
5. **Create `audit_crawl_queue` table** — FK cascade delete
6. **Create `audit_ai_analyses` table** — with `platform_readiness` jsonb, `citability_passages` jsonb, FK cascade delete
7. **Create all indexes** from design doc
8. **Create RLS policies** — following existing patterns from `site_audits`:
   - Organization members SELECT/INSERT/DELETE
   - One-time audit owner SELECT/INSERT/DELETE (organization_id IS NULL AND created_by = auth.uid())
   - Internal users SELECT/DELETE all
   - Service role full access
   - Cascade policies on all child tables (audit_checks, audit_pages, audit_ai_analyses, audit_crawl_queue)
9. **Update `dismissed_checks`** — ensure it works with new check names (no schema change needed, `check_name` is already text)
10. **Add `SharedResourceType` value** — add 'unified_audit' to shared_links resource_type check constraint (if using check constraint) or just use it as a new value

**Important patterns to follow** (read these files for reference):

- `supabase/migrations/20260118000002_create_site_audits.sql` — table structure pattern
- `supabase/migrations/20260125030000_fix_one_time_audit_rls.sql` — one-time audit RLS pattern
- `supabase/migrations/20260225000000_fix_function_search_paths_and_service_role_policies.sql` — service role pattern

**Step 2: Test the migration locally**

Run: `supabase db reset`
Expected: All migrations apply successfully, no errors

**Step 3: Verify tables exist**

Run: `supabase db reset && supabase status` (verify tables created)

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(audit): create unified audit database tables with RLS policies"
```

---

### Task 1.4: Milestone 1 Checkpoint

**Step 1: Run full verification**

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

Fix any issues before proceeding.

**Step 2: Commit any fixes**

```bash
git add -A
git commit -m "chore: milestone 1 lint/format/test fixes"
```

---

## Milestone 2: Check Registry & Ported Checks

### Task 2.1: Create Unified Check Registry Structure

**Files:**

- Create: `lib/unified-audit/checks/index.ts`
- Create: `lib/unified-audit/checks/types.ts` (re-export from parent types for convenience)
- Test: `tests/unit/lib/unified-audit/checks/registry.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/unified-audit/checks/registry.test.ts
import {
  allChecks,
  getChecksByCategory,
  getChecksByScore,
  siteWideChecks,
  pageSpecificChecks,
} from '@/lib/unified-audit/checks'
import { CheckCategory, ScoreDimension } from '@/lib/enums'

describe('Unified Check Registry', () => {
  test('has exactly 55 checks', () => {
    expect(allChecks).toHaveLength(55)
  })

  test('every check has required fields', () => {
    for (const check of allChecks) {
      expect(check.name).toBeTruthy()
      expect(Object.values(CheckCategory)).toContain(check.category)
      expect(check.priority).toBeTruthy()
      expect(check.description).toBeTruthy()
      expect(check.displayName).toBeTruthy()
      expect(check.displayNamePassed).toBeTruthy()
      expect(check.feedsScores.length).toBeGreaterThan(0)
      expect(typeof check.run).toBe('function')
    }
  })

  test('no duplicate check names', () => {
    const names = allChecks.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('getChecksByCategory returns correct counts', () => {
    expect(getChecksByCategory(CheckCategory.Crawlability)).toHaveLength(7)
    expect(getChecksByCategory(CheckCategory.MetaContent)).toHaveLength(11)
    expect(getChecksByCategory(CheckCategory.ContentStructure)).toHaveLength(9)
    expect(getChecksByCategory(CheckCategory.ContentQuality)).toHaveLength(5)
    expect(getChecksByCategory(CheckCategory.Links)).toHaveLength(4)
    expect(getChecksByCategory(CheckCategory.Media)).toHaveLength(3)
    expect(getChecksByCategory(CheckCategory.StructuredData)).toHaveLength(4)
    expect(getChecksByCategory(CheckCategory.Security)).toHaveLength(2)
    expect(getChecksByCategory(CheckCategory.Performance)).toHaveLength(4)
    expect(getChecksByCategory(CheckCategory.AIVisibility)).toHaveLength(6)
  })

  test('getChecksByScore filters correctly', () => {
    const seoChecks = getChecksByScore(ScoreDimension.SEO)
    const perfChecks = getChecksByScore(ScoreDimension.Performance)
    const aiChecks = getChecksByScore(ScoreDimension.AIReadiness)

    // Every check should feed at least one score
    for (const check of allChecks) {
      const inSeo = seoChecks.includes(check)
      const inPerf = perfChecks.includes(check)
      const inAi = aiChecks.includes(check)
      expect(inSeo || inPerf || inAi).toBe(true)
    }
  })

  test('siteWideChecks and pageSpecificChecks partition all checks', () => {
    expect(siteWideChecks.length + pageSpecificChecks.length).toBe(allChecks.length)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/unified-audit/checks/registry.test.ts --run`
Expected: FAIL

**Step 3: Create the registry barrel file**

Create `lib/unified-audit/checks/index.ts` — initially with empty arrays and helper functions. We'll populate it as we port checks.

```typescript
import { CheckCategory, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition } from '../types'

// Import check arrays from each category (will be populated in subsequent tasks)
import { crawlabilityChecks } from './crawlability'
import { metaContentChecks } from './meta-content'
import { contentStructureChecks } from './content-structure'
import { contentQualityChecks } from './content-quality'
import { linksChecks } from './links'
import { mediaChecks } from './media'
import { structuredDataChecks } from './structured-data'
import { securityChecks } from './security'
import { performanceChecks } from './performance'
import { aiVisibilityChecks } from './ai-visibility'

export const allChecks: AuditCheckDefinition[] = [
  ...crawlabilityChecks,
  ...metaContentChecks,
  ...contentStructureChecks,
  ...contentQualityChecks,
  ...linksChecks,
  ...mediaChecks,
  ...structuredDataChecks,
  ...securityChecks,
  ...performanceChecks,
  ...aiVisibilityChecks,
]

export function getChecksByCategory(category: CheckCategory): AuditCheckDefinition[] {
  return allChecks.filter((c) => c.category === category)
}

export function getChecksByScore(dimension: ScoreDimension): AuditCheckDefinition[] {
  return allChecks.filter((c) => c.feedsScores.includes(dimension))
}

export const siteWideChecks = allChecks.filter((c) => c.isSiteWide)
export const pageSpecificChecks = allChecks.filter((c) => !c.isSiteWide)
```

**Step 4: Create stub category files**

Create one file per category under `lib/unified-audit/checks/`:

- `crawlability/index.ts`
- `meta-content/index.ts`
- `content-structure/index.ts`
- `content-quality/index.ts`
- `links/index.ts`
- `media/index.ts`
- `structured-data/index.ts`
- `security/index.ts`
- `performance/index.ts`
- `ai-visibility/index.ts`

Each exports an empty array initially: `export const xxxChecks: AuditCheckDefinition[] = []`

Tests will fail on counts but the structure compiles. We port checks category by category in subsequent tasks.

**Step 5: Commit**

```bash
git add lib/unified-audit/checks/ tests/unit/lib/unified-audit/checks/
git commit -m "feat(audit): create unified check registry structure with 10 category modules"
```

---

### Task 2.2: Port Crawlability Checks (7 checks)

**Files:**

- Create: `lib/unified-audit/checks/crawlability/robots-txt-validation.ts`
- Create: `lib/unified-audit/checks/crawlability/ai-crawler-access.ts` (enhanced)
- Create: `lib/unified-audit/checks/crawlability/sitemap-detection.ts`
- Create: `lib/unified-audit/checks/crawlability/noindex-detection.ts`
- Create: `lib/unified-audit/checks/crawlability/http-to-https-redirect.ts`
- Create: `lib/unified-audit/checks/crawlability/llms-txt.ts` (enhanced)
- Create: `lib/unified-audit/checks/crawlability/js-rendering.ts` (deduplicated)
- Modify: `lib/unified-audit/checks/crawlability/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/crawlability.test.ts`

**Step 1: Write tests for all 7 checks**

Test each check with mock HTML/context. Key tests:

- `ai-crawler-access`: Test with robots.txt blocking GPTBot, ClaudeBot — verify per-bot breakdown in details
- `llms-txt`: Test missing → fail, malformed → fail, minimal → warning, valid → pass
- `js-rendering`: Merged check — test SSR detection and framework identification

Reference existing tests patterns — check `tests/unit/lib/` for any existing check tests, otherwise follow the `CheckContext` interface for mock data.

**Step 2: Run tests to verify they fail**

**Step 3: Port and enhance checks**

For each check:

1. Copy the existing implementation from `lib/audit/checks/seo/` or `lib/audit/checks/ai/` or `lib/aio/checks/`
2. Update the interface to use `AuditCheckDefinition` (add `category`, `feedsScores`)
3. Apply enhancements where noted:
   - `ai-crawler-access`: Add per-bot breakdown with 14+ bots, return `AICrawlerBreakdown` in details
   - `llms-txt`: Add 3-tier validation, return `LlmsTxtValidation` in details
   - `js-rendering`: Merge logic from `lib/audit/checks/ai/js-rendered-content.ts` and `lib/aio/checks/technical-foundation/javascript-rendering.ts`

**Key source files to reference:**

- `lib/audit/checks/seo/missing-robots-txt.ts` → `robots-txt-validation`
- `lib/audit/checks/ai/ai-crawlers-blocked.ts` → `ai-crawler-access` (enhance)
- `lib/audit/checks/seo/missing-sitemap.ts` → `sitemap-detection`
- `lib/audit/checks/seo/noindex-on-important-pages.ts` → `noindex-detection`
- `lib/audit/checks/seo/http-to-https-redirect.ts` → `http-to-https-redirect`
- `lib/audit/checks/ai/missing-llms-txt.ts` → `llms-txt` (enhance)
- `lib/audit/checks/ai/js-rendered-content.ts` + `lib/aio/checks/technical-foundation/javascript-rendering.ts` → `js-rendering` (merge)

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add lib/unified-audit/checks/crawlability/ tests/unit/lib/unified-audit/checks/crawlability.test.ts
git commit -m "feat(audit): port and enhance crawlability checks (7 checks, 2 enhanced, 1 deduplicated)"
```

---

### Task 2.3: Port Meta-Content Checks (11 checks)

**Files:**

- Create: `lib/unified-audit/checks/meta-content/*.ts` (11 check files)
- Modify: `lib/unified-audit/checks/meta-content/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/meta-content.test.ts`

**Step 1-5: Same TDD pattern as Task 2.2**

All 11 checks are existing ports with no changes. Source files in `lib/audit/checks/seo/`:

- `missing-title.ts`, `title-length.ts`, `duplicate-titles.ts`
- `missing-meta-description.ts`, `meta-description-length.ts`, `duplicate-meta-descriptions.ts`
- `missing-canonical.ts`, `canonical-validation.ts`
- `missing-viewport.ts` (from `lib/audit/checks/technical/`)
- `missing-og-tags.ts`, `missing-favicon.ts` (from `lib/audit/checks/technical/`)

Update each to use `AuditCheckDefinition` with `category: CheckCategory.MetaContent` and `feedsScores: [ScoreDimension.SEO]`.

**Commit message:** `feat(audit): port meta-content checks (11 checks, all existing)`

---

### Task 2.4: Port Content-Structure Checks (9 checks)

**Files:**

- Create: `lib/unified-audit/checks/content-structure/*.ts` (9 check files)
- Modify: `lib/unified-audit/checks/content-structure/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/content-structure.test.ts`

**Step 1-5: Same TDD pattern**

Sources:

- `missing-h1.ts`, `multiple-h1.ts`, `heading-hierarchy.ts` — from `lib/audit/checks/seo/`
- `faq-section.ts` — **deduplicated** merge of `lib/audit/checks/ai/no-faq-content.ts` + `lib/aio/checks/content-structure/faq-section.ts`. Take the richer implementation (likely AIO version).
- `definition-boxes.ts`, `step-by-step-guides.ts`, `summary-sections.ts`, `citation-format.ts`, `comparison-tables.ts` — from `lib/aio/checks/content-structure/`

Key: `heading-hierarchy`, `faq-section`, and content-structure AIO checks feed `[ScoreDimension.SEO, ScoreDimension.AIReadiness]`.

**Commit message:** `feat(audit): port content-structure checks (9 checks, 1 deduplicated)`

---

### Task 2.5: Port Content-Quality Checks (5 checks)

**Files:**

- Create: `lib/unified-audit/checks/content-quality/*.ts` (5 check files)
- Modify: `lib/unified-audit/checks/content-quality/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/content-quality.test.ts`

**Step 1-5: Same TDD pattern**

Sources:

- `content-depth.ts` — **merged** from `lib/audit/checks/seo/thin-content.ts` + `lib/aio/checks/content-quality/content-depth.ts`. Use the AIO version with tiered thresholds (<300 fail, 300-800 warning, 800-1500 pass, >1500 excellent).
- `readability.ts`, `paragraph-structure.ts`, `list-usage.ts` — from `lib/aio/checks/content-quality/`
- `content-freshness.ts` — **deduplicated** from `lib/audit/checks/ai/no-recent-updates.ts`. Update thresholds: <90 days pass, 90-365 warning, >365 fail.

All feed `[ScoreDimension.SEO, ScoreDimension.AIReadiness]`.

**Commit message:** `feat(audit): port content-quality checks (5 checks, 2 deduplicated/merged)`

---

### Task 2.6: Port Links Checks (4 checks)

**Files:**

- Create: `lib/unified-audit/checks/links/*.ts` (4 check files)
- Modify: `lib/unified-audit/checks/links/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/links.test.ts`

**Step 1-5: Same TDD pattern**

Sources:

- `broken-internal-links.ts`, `redirect-chains.ts`, `non-descriptive-url.ts` — from `lib/audit/checks/seo/`
- `internal-linking.ts` — from `lib/aio/checks/content-quality/`. Feeds `[ScoreDimension.SEO, ScoreDimension.AIReadiness]`.

**Commit message:** `feat(audit): port links checks (4 checks)`

---

### Task 2.7: Port Media Checks (3 checks)

**Files:**

- Create: `lib/unified-audit/checks/media/*.ts` (3 check files)
- Modify: `lib/unified-audit/checks/media/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/media.test.ts`

**Step 1-5: Same TDD pattern**

Sources:

- `images-missing-alt.ts` — from `lib/audit/checks/seo/`. Update `feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness]`
- `oversized-images.ts` — from `lib/audit/checks/seo/`
- `media-richness.ts` — from `lib/aio/checks/content-quality/`

**Commit message:** `feat(audit): port media checks (3 checks)`

---

### Task 2.8: Port Structured-Data Checks (4 checks, 2 new, 1 enhanced)

**Files:**

- Create: `lib/unified-audit/checks/structured-data/schema-markup.ts` (deduplicated)
- Create: `lib/unified-audit/checks/structured-data/organization-schema.ts` (enhanced with sameAs)
- Create: `lib/unified-audit/checks/structured-data/speakable-schema.ts` (NEW)
- Create: `lib/unified-audit/checks/structured-data/schema-validation.ts` (NEW)
- Modify: `lib/unified-audit/checks/structured-data/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/structured-data.test.ts`

**Step 1: Write tests — pay special attention to new checks**

```typescript
describe('speakable-schema', () => {
  test('fails when no speakable property on any schema', async () => {
    const html = '<script type="application/ld+json">{"@type":"Article","headline":"Test"}</script>'
    const result = await speakableCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Failed)
  })

  test('passes when speakable property found with valid selectors', async () => {
    const html =
      '<script type="application/ld+json">{"@type":"Article","speakable":{"@type":"SpeakableSpecification","cssSelector":[".article-body",".article-summary"]}}</script>'
    const result = await speakableCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Passed)
  })
})

describe('schema-validation', () => {
  test('fails when Article schema missing required properties', async () => {
    const html = '<script type="application/ld+json">{"@type":"Article","headline":"Test"}</script>'
    const result = await schemaValidationCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details.schemas[0].missingRequired).toContain('author')
  })

  test('passes when all required properties present', async () => {
    const html =
      '<script type="application/ld+json">{"@type":"Article","headline":"Test","author":{"@type":"Person","name":"John"},"datePublished":"2026-01-01","image":"https://example.com/img.jpg"}</script>'
    const result = await schemaValidationCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Passed)
  })
})

describe('organization-schema (enhanced)', () => {
  test('warns when Organization schema exists but no sameAs', async () => {
    const html =
      '<script type="application/ld+json">{"@type":"Organization","name":"Test Corp","url":"https://example.com"}</script>'
    const result = await orgSchemaCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details.sameAs.present).toBe(false)
  })

  test('passes when sameAs links to 2+ platforms', async () => {
    const html =
      '<script type="application/ld+json">{"@type":"Organization","name":"Test","url":"https://example.com","sameAs":["https://linkedin.com/company/test","https://twitter.com/test","https://en.wikipedia.org/wiki/Test"]}</script>'
    const result = await orgSchemaCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details.sameAs.hasWikipedia).toBe(true)
  })
})
```

**Step 2-5: Implement and test**

Sources:

- `schema-markup.ts` — merge `lib/audit/checks/ai/missing-structured-data.ts` + `lib/aio/checks/technical-foundation/schema-markup.ts`
- `organization-schema.ts` — enhance `lib/audit/checks/ai/missing-organization-schema.ts` with `sameAs` validation. Return `OrganizationSchemaDetails` in details.
- `speakable-schema.ts` — NEW. Parse JSON-LD, look for `speakable` or `SpeakableSpecification`. Return `SpeakableSchemaDetails`.
- `schema-validation.ts` — NEW. Parse all JSON-LD schemas, validate required properties by type. Return `SchemaValidationDetails`.

**Commit message:** `feat(audit): port structured-data checks (4 checks, 2 new, 1 enhanced, 1 deduplicated)`

---

### Task 2.9: Port Security Checks (2 checks)

**Files:**

- Create: `lib/unified-audit/checks/security/ssl-certificate.ts` (deduplicated)
- Create: `lib/unified-audit/checks/security/mixed-content.ts`
- Modify: `lib/unified-audit/checks/security/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/security.test.ts`

**Step 1-5: Same TDD pattern**

Sources:

- `ssl-certificate.ts` — merge `lib/audit/checks/technical/missing-ssl.ts` + `lib/audit/checks/technical/invalid-ssl-certificate.ts` + `lib/aio/checks/technical-foundation/ssl-certificate.ts`. Single check handles presence + validity.
- `mixed-content.ts` — from `lib/audit/checks/technical/mixed-content.ts`

**Commit message:** `feat(audit): port security checks (2 checks, 1 deduplicated from 3 sources)`

---

### Task 2.10: Port Performance Checks (4 checks)

**Files:**

- Create: `lib/unified-audit/checks/performance/page-response-time.ts` (deduplicated)
- Create: `lib/unified-audit/checks/performance/lighthouse-scores.ts` (normalized from PSI)
- Create: `lib/unified-audit/checks/performance/core-web-vitals.ts` (normalized from PSI)
- Create: `lib/unified-audit/checks/performance/mobile-friendly.ts`
- Modify: `lib/unified-audit/checks/performance/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/performance.test.ts`

**Step 1: Write tests**

Key: `lighthouse-scores` and `core-web-vitals` receive PSI API data via the `details` field in `CheckContext` (we'll extend CheckContext to allow passing external data). Tests should verify:

- `lighthouse-scores`: performance ≥90 → pass, 50-89 → warning, <50 → fail. Raw scores stored in details.
- `core-web-vitals`: LCP ≤2.5s good, ≤4s needs-improvement, >4s poor (similar for INP, CLS). Overall: all good → pass, any poor → fail, else warning.

```typescript
describe('lighthouse-scores', () => {
  test('passes when performance score >= 90', async () => {
    const context = {
      url: 'https://example.com',
      html: '',
      psiData: { performance: 95, accessibility: 88, bestPractices: 92, seo: 90 },
    }
    const result = await lighthouseCheck.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details.scores.performance).toBe(95)
  })
})
```

**Step 2-5: Implement and test**

Sources:

- `page-response-time.ts` — merge `lib/audit/checks/ai/slow-page-response.ts` + `lib/aio/checks/technical-foundation/page-speed.ts`
- `lighthouse-scores.ts` — NEW format wrapping PSI data. The runner will pass PSI results into the check context.
- `core-web-vitals.ts` — NEW format wrapping PSI CWV data. Normalize to pass/fail/warning.
- `mobile-friendly.ts` — from `lib/aio/checks/technical-foundation/mobile-friendly.ts`

**Commit message:** `feat(audit): port performance checks (4 checks, 1 deduplicated, 2 normalized from PSI)`

---

### Task 2.11: Port AI-Visibility Checks (6 existing + stubs for 3 new)

**Files:**

- Create: `lib/unified-audit/checks/ai-visibility/citability.ts` (NEW - programmatic baseline)
- Create: `lib/unified-audit/checks/ai-visibility/brand-mentions.ts` (NEW)
- Create: `lib/unified-audit/checks/ai-visibility/platform-readiness.ts` (NEW - stub, runs in AI phase)
- Create: `lib/unified-audit/checks/ai-visibility/content-accessibility.ts`
- Create: `lib/unified-audit/checks/ai-visibility/html-structure.ts`
- Create: `lib/unified-audit/checks/ai-visibility/markdown-availability.ts`
- Modify: `lib/unified-audit/checks/ai-visibility/index.ts`
- Test: `tests/unit/lib/unified-audit/checks/ai-visibility.test.ts`

**Step 1: Write tests for new checks**

```typescript
describe('citability', () => {
  test('passes when content has citable passages', async () => {
    const html = `<article>
      <h2>What is SEO?</h2>
      <p>Search Engine Optimization (SEO) is the practice of optimizing websites to increase their visibility in search engine results pages. According to a 2025 study by Ahrefs, 68% of all online experiences begin with a search engine. Effective SEO involves technical optimization, content creation, and link building strategies that help search engines understand and rank your content for relevant queries.</p>
    </article>`
    const result = await citabilityCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details.citablePassages).toBeGreaterThan(0)
  })

  test('fails when content has no citable passages', async () => {
    const html = '<p>Click here to learn more. We offer great services.</p>'
    const result = await citabilityCheck.run({ html, url: 'https://example.com' })
    expect(result.status).toBe(CheckStatus.Failed)
  })
})

describe('brand-mentions', () => {
  test('returns Wikipedia and Wikidata status', async () => {
    // Mock fetch for Wikipedia/Wikidata APIs
    const result = await brandMentionsCheck.run({
      html: '<title>Anthropic</title>',
      url: 'https://anthropic.com',
    })
    expect(result.details).toHaveProperty('wikipedia')
    expect(result.details).toHaveProperty('wikidata')
    expect(result.details).toHaveProperty('gaps')
  })
})
```

**Step 2-5: Implement and test**

Sources for existing:

- `content-accessibility.ts` — from `lib/aio/checks/technical-foundation/content-accessibility.ts`
- `html-structure.ts` — from `lib/aio/checks/technical-foundation/html-structure.ts`
- `markdown-availability.ts` — from `lib/audit/checks/ai/missing-markdown.ts`

New implementations:

- `citability.ts` — Programmatic passage analysis. Extract text blocks from HTML, score each for: passage length (100-200 words), definition patterns, statistics, self-containment (pronoun density), factual claims, heading context, list format. Return `CitabilityDetails`.
- `brand-mentions.ts` — HTTP calls to Wikipedia API + Wikidata API. Extract brand name from `<title>` or Organization schema. Return `BrandMentionDetails`. **Note:** This check needs actual HTTP calls, so mock them in tests.
- `platform-readiness.ts` — Stub that returns `CheckStatus.Passed` by default. The real scoring happens in the Claude AI analysis phase. This check's result will be updated by the AI analysis runner after Claude provides platform scores.

**Note on ai-visibility count:** The design shows 8 checks but `ai-crawler-access` (which shows the detailed breakdown) and `llms-txt` (which does 3-tier validation) live in `crawlability` and display in both tabs. So `ai-visibility` has 6 unique checks, not 8. The `ai-crawler-access` and `llms-txt` checks from crawlability are shown in the AI Readiness tab via `feedsScores` filtering.

**Commit message:** `feat(audit): implement ai-visibility checks (6 checks, 3 new including citability and brand-mentions)`

---

### Task 2.12: Milestone 2 Checkpoint

**Step 1: Verify all 55 checks are registered**

Update the registry test count expectations in `tests/unit/lib/unified-audit/checks/registry.test.ts` to match actual counts (55 total, correct per-category counts).

**Step 2: Run full verification**

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: milestone 2 — all 55 checks ported, tested, lint clean"
```

---

## Milestone 3: Unified Scoring Calculator

### Task 3.1: Build Score Calculator

**Files:**

- Create: `lib/unified-audit/scoring.ts`
- Test: `tests/unit/lib/unified-audit/scoring.test.ts`

**Step 1: Write comprehensive tests**

```typescript
import {
  calculateCheckScore,
  calculateSEOScore,
  calculatePerformanceScore,
  calculateAIReadinessScore,
  calculateOverallScore,
  getScoreStatus,
} from '@/lib/unified-audit/scoring'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'

describe('Unified Scoring', () => {
  const makeCheck = (overrides: Partial<AuditCheck>): AuditCheck => ({
    id: 'test',
    audit_id: 'audit',
    page_url: null,
    category: CheckCategory.Crawlability,
    check_name: 'test',
    priority: CheckPriority.Critical,
    status: CheckStatus.Passed,
    display_name: 'Test',
    display_name_passed: 'Test passed',
    description: '',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [ScoreDimension.SEO],
    created_at: '',
    ...overrides,
  })

  test('calculateCheckScore weights critical 3x, recommended 2x, optional 1x', () => {
    // All critical passed = 100
    const checks = [
      makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Passed }),
      makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Passed }),
    ]
    expect(calculateCheckScore(checks)).toBe(100)
  })

  test('calculateCheckScore handles mix of pass/warn/fail', () => {
    const checks = [
      makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Passed }), // 3 * 100 = 300
      makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Failed }), // 3 * 0 = 0
      makeCheck({ priority: CheckPriority.Recommended, status: CheckStatus.Warning }), // 2 * 50 = 100
    ]
    // total weight = 3+3+2 = 8, earned = 300+0+100 = 400
    // score = 400/800 * 100 = 50
    expect(calculateCheckScore(checks)).toBe(50)
  })

  test('calculateSEOScore only uses checks that feed SEO', () => {
    const checks = [
      makeCheck({ feeds_scores: [ScoreDimension.SEO], status: CheckStatus.Passed }),
      makeCheck({ feeds_scores: [ScoreDimension.Performance], status: CheckStatus.Failed }),
    ]
    expect(calculateSEOScore(checks)).toBe(100) // Performance check excluded
  })

  test('calculateAIReadinessScore combines programmatic and strategic', () => {
    const checks = [
      makeCheck({ feeds_scores: [ScoreDimension.AIReadiness], status: CheckStatus.Passed }),
    ]
    // With strategic score: 40% programmatic + 60% strategic
    const score = calculateAIReadinessScore(checks, 80)
    expect(score).toBe(Math.round(100 * 0.4 + 80 * 0.6)) // 88
  })

  test('calculateAIReadinessScore uses 100% programmatic when no AI analysis', () => {
    const checks = [
      makeCheck({ feeds_scores: [ScoreDimension.AIReadiness], status: CheckStatus.Passed }),
    ]
    const score = calculateAIReadinessScore(checks, null)
    expect(score).toBe(100)
  })

  test('calculateOverallScore uses correct weights', () => {
    // SEO: 80, Performance: 70, AI: 90
    // Overall = 80*0.4 + 70*0.3 + 90*0.3 = 32 + 21 + 27 = 80
    expect(calculateOverallScore(80, 70, 90)).toBe(80)
  })

  test('calculateOverallScore returns null when any score is null', () => {
    expect(calculateOverallScore(80, null, 90)).toBeNull()
  })

  test('getScoreStatus returns correct status', () => {
    expect(getScoreStatus(85)).toBe('good')
    expect(getScoreStatus(65)).toBe('needs_improvement')
    expect(getScoreStatus(45)).toBe('poor')
  })
})
```

**Step 2: Run to verify fails**

**Step 3: Implement scoring**

```typescript
// lib/unified-audit/scoring.ts
import { CheckPriority, CheckStatus, ScoreDimension, ScoreStatus } from '@/lib/enums'
import type { AuditCheck, ScoreWeights } from './types'

const PRIORITY_WEIGHTS = {
  [CheckPriority.Critical]: 3,
  [CheckPriority.Recommended]: 2,
  [CheckPriority.Optional]: 1,
}

const STATUS_POINTS = {
  [CheckStatus.Passed]: 100,
  [CheckStatus.Warning]: 50,
  [CheckStatus.Failed]: 0,
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  seo: 0.4,
  performance: 0.3,
  ai_readiness: 0.3,
}

export function calculateCheckScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0
  let totalWeight = 0
  let earnedWeight = 0
  for (const check of checks) {
    const weight = PRIORITY_WEIGHTS[check.priority as CheckPriority] ?? 1
    totalWeight += weight
    earnedWeight += weight * (STATUS_POINTS[check.status as CheckStatus] ?? 0)
  }
  if (totalWeight === 0) return 0
  return Math.round((earnedWeight / (totalWeight * 100)) * 100)
}

export function calculateSEOScore(checks: AuditCheck[]): number {
  return calculateCheckScore(checks.filter((c) => c.feeds_scores.includes(ScoreDimension.SEO)))
}

export function calculatePerformanceScore(checks: AuditCheck[]): number {
  return calculateCheckScore(
    checks.filter((c) => c.feeds_scores.includes(ScoreDimension.Performance))
  )
}

export function calculateAIReadinessScore(
  checks: AuditCheck[],
  strategicScore: number | null
): number {
  const programmaticScore = calculateCheckScore(
    checks.filter((c) => c.feeds_scores.includes(ScoreDimension.AIReadiness))
  )
  if (strategicScore === null) return programmaticScore
  return Math.round(programmaticScore * 0.4 + strategicScore * 0.6)
}

export function calculateOverallScore(
  seo: number | null,
  performance: number | null,
  aiReadiness: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number | null {
  if (seo === null || performance === null || aiReadiness === null) return null
  return Math.round(
    seo * weights.seo + performance * weights.performance + aiReadiness * weights.ai_readiness
  )
}

export function getScoreStatus(score: number): string {
  if (score >= 80) return ScoreStatus.Good
  if (score >= 60) return ScoreStatus.NeedsImprovement
  return ScoreStatus.Poor
}
```

**Step 4: Run tests to verify pass**

**Step 5: Commit**

```bash
git add lib/unified-audit/scoring.ts tests/unit/lib/unified-audit/scoring.test.ts
git commit -m "feat(audit): implement unified scoring calculator with 3 dimensions + overall"
```

---

### Task 3.2: Milestone 3 Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

```bash
git commit -m "chore: milestone 3 — scoring calculator complete, all tests pass"
```

---

## Milestone 4: Unified Audit Runner (Execution Engine)

### Task 4.1: Build Crawl Phase

**Files:**

- Create: `lib/unified-audit/runner.ts`
- Test: `tests/unit/lib/unified-audit/runner.test.ts`

**Step 1: Write tests for crawl orchestration**

Test:

- Standard mode: crawls up to `max_pages`, calls page callback for each
- Exhaustive mode: crawls until soft cap, sets `soft_cap_reached = true`, status → `awaiting_confirmation`
- Batch continuation: triggers self via POST when approaching timeout
- DB updates: pages_crawled increments, status transitions

Reference `lib/audit/runner.ts` (lines 332-443) for existing batch pattern.

**Step 2-5: Implement**

The runner reuses existing crawl infrastructure:

- `lib/audit/crawler.ts` — `crawlPage()` for link discovery
- `lib/audit/batch-crawler.ts` — batch processing pattern
- `lib/audit/fetcher.ts` — HTML fetching

New: Add `crawl_mode` and `soft_cap_reached` handling. When exhaustive mode and pages_crawled >= max_pages, set `soft_cap_reached = true` and status to `awaiting_confirmation`.

**Commit message:** `feat(audit): implement unified runner crawl phase with standard/exhaustive modes`

---

### Task 4.2: Build Parallel Analysis Phase

**Files:**

- Modify: `lib/unified-audit/runner.ts`
- Test: `tests/unit/lib/unified-audit/runner-analysis.test.ts`

**Step 1: Write tests**

Test:

- After crawl, three workstreams run in parallel: programmatic checks, PSI, AI analysis
- Progress tracking: check counts, PSI page counts, AI page counts
- PSI results normalized to check format (lighthouse-scores, core-web-vitals stored as audit_checks)
- AI analysis results stored in audit_ai_analyses
- All three complete before scoring begins

**Step 2-5: Implement**

Structure:

```typescript
async function runAnalysisPhase(auditId: string, pages: AuditPage[], audit: UnifiedAudit) {
  await Promise.all([
    runProgrammaticChecks(auditId, pages, audit),
    runPSIChecks(auditId, pages, audit),
    runAIAnalysis(auditId, pages, audit),
  ])
}
```

- `runProgrammaticChecks`: Iterate site-wide checks (on homepage), then page-specific checks (on each page). Save to `audit_checks`.
- `runPSIChecks`: Call PSI API for top pages (homepage + key pages). Normalize Lighthouse scores and CWV into `audit_checks` records.
- `runAIAnalysis`: Select top pages by importance scoring (reuse `lib/aio/importance.ts`), run Claude AI analysis in batches (reuse `lib/aio/ai-auditor.ts`). Save to `audit_ai_analyses`. Update the AI skill prompt to also return `platform_readiness` and `citability_passages`.

Reference:

- `lib/performance/runner.ts` — PSI execution flow
- `lib/aio/background.ts` — AI analysis flow
- `lib/aio/ai-auditor.ts` — Claude API integration

**Commit message:** `feat(audit): implement parallel analysis phase — checks, PSI, and AI analysis`

---

### Task 4.3: Build Scoring Phase & Completion

**Files:**

- Modify: `lib/unified-audit/runner.ts`
- Test: `tests/unit/lib/unified-audit/runner-scoring.test.ts`

**Step 1: Write tests**

Test:

- After analysis, scores calculated correctly from check data
- SEO score from SEO-feeding checks
- Performance score from performance checks
- AI Readiness score from AI checks + strategic score
- Overall score from weighted composite
- Status → `completed`, counts updated, completion timestamp set

**Step 2-5: Implement**

After all analysis completes:

1. Fetch all `audit_checks` for this audit
2. Fetch all `audit_ai_analyses` for this audit
3. Calculate `strategicScore` from AI analyses (reuse `calculateStrategicScore` from `lib/aio/ai-auditor.ts`)
4. Calculate SEO, Performance, AI Readiness scores via `lib/unified-audit/scoring.ts`
5. Calculate overall score
6. Update `audits` record with all scores, counts, completion time

**Commit message:** `feat(audit): implement scoring phase and audit completion flow`

---

### Task 4.4: Build Progress Tracking

**Files:**

- Modify: `lib/unified-audit/runner.ts`
- Create: `lib/unified-audit/progress.ts`
- Test: `tests/unit/lib/unified-audit/progress.test.ts`

**Step 1: Write tests**

Test the progress data structure:

```typescript
interface AuditProgress {
  phase: 'crawling' | 'analyzing' | 'scoring' | 'completed' | 'failed' | 'awaiting_confirmation'
  crawl: { status: 'pending' | 'running' | 'complete'; pagesCrawled: number; maxPages: number }
  analysis: {
    checks: { status: 'pending' | 'running' | 'complete'; completed: number; total: number }
    psi: { status: 'pending' | 'running' | 'complete'; completed: number; total: number }
    ai: { status: 'pending' | 'running' | 'complete'; completed: number; total: number }
  }
  scoring: { status: 'pending' | 'running' | 'complete' }
}
```

**Step 2-5: Implement**

Store progress in the `audits` table using a `progress` jsonb column (add to migration if not yet present) or compute from check/page counts. Exposed via the status API endpoint.

**Commit message:** `feat(audit): implement phased progress tracking for audit execution`

---

### Task 4.5: Build API Endpoints

**Files:**

- Create: `app/api/unified-audit/start/route.ts`
- Create: `app/api/unified-audit/[id]/status/route.ts`
- Create: `app/api/unified-audit/[id]/continue/route.ts`
- Create: `app/api/unified-audit/[id]/stop/route.ts`
- Create: `app/api/unified-audit/[id]/resume/route.ts`
- Create: `app/api/unified-audit/[id]/confirm-continue/route.ts` (new — for exhaustive soft cap)
- Test: `tests/unit/app/api/unified-audit.test.ts`

**Step 1: Write tests for key endpoints**

Test:

- `POST /api/unified-audit/start`: Creates audit, returns auditId, starts background processing
- `GET /api/unified-audit/[id]/status`: Returns progress data
- `POST /api/unified-audit/[id]/confirm-continue`: Resumes crawling after soft cap (sets `soft_cap_reached = false`, increases `max_pages`, status → `crawling`)
- Auth checks: organization access, one-time audit ownership, internal user bypass

**Step 2-5: Implement**

Follow patterns from existing endpoints:

- `app/api/audit/start/route.ts` — auth, org verification, background execution with `after()`
- `app/api/audit/[id]/status/route.ts` — progress reporting
- `app/api/audit/[id]/continue/route.ts` — batch continuation with CRON_SECRET

New: `confirm-continue` endpoint for exhaustive mode soft cap confirmation.

**Commit message:** `feat(audit): implement unified audit API endpoints`

---

### Task 4.6: Milestone 4 Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

```bash
git commit -m "chore: milestone 4 — unified runner complete with parallel analysis, progress tracking, API endpoints"
```

---

## Milestone 5: Server Actions & Data Layer

### Task 5.1: Create Unified Audit Server Actions

**Files:**

- Create: `app/(authenticated)/seo/audit/actions.ts`
- Test: `tests/unit/app/seo/audit/actions.test.ts`

**Step 1: Write tests**

Test server actions:

- `startAudit(url, options)` — validates URL, creates audit, triggers API
- `getAudit(id)` — fetches audit with auth check
- `getAuditChecks(auditId, filters)` — fetches checks, supports category/status/score filtering
- `getAuditHistory(orgId)` — fetches past audits for org
- `deleteAudit(id)` — soft delete with auth check
- `dismissCheck(checkName, orgId)` — dismiss check for org
- `confirmContinueCrawl(auditId)` — resume exhaustive crawl after soft cap

**Step 2-5: Implement**

Follow patterns from:

- `app/(authenticated)/seo/site-audit/actions.ts`
- `app/(authenticated)/seo/aio/actions.ts`

Use `withAuth()` or direct `supabase.auth.getUser()` + user lookup pattern.

**Commit message:** `feat(audit): implement unified audit server actions`

---

### Task 5.2: Create Unified Audit Detail Actions

**Files:**

- Create: `app/(authenticated)/seo/audit/[id]/actions.ts`
- Test: `tests/unit/app/seo/audit/[id]/actions.test.ts`

**Step 1: Write tests**

Test:

- `getAuditDetail(id)` — returns full audit with checks, pages, AI analyses
- `getAuditChecksByTab(auditId, tab)` — returns checks filtered for specific tab (SEO, Performance, AI Readiness)
- `getAuditAIAnalyses(auditId)` — returns AI analysis data
- `getAuditProgress(auditId)` — returns progress for live display

**Step 2-5: Implement**

**Commit message:** `feat(audit): implement unified audit detail server actions`

---

### Task 5.3: Milestone 5 Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

```bash
git commit -m "chore: milestone 5 — server actions complete"
```

---

## Milestone 6: UI — Audit Creation & Progress

### Task 6.1: Build Audit Creation Page

**Files:**

- Create: `app/(authenticated)/seo/audit/page.tsx`
- Create: `app/(authenticated)/seo/audit/client.tsx`
- Test: `tests/unit/components/audit/audit-creation.test.tsx`

**Step 1: Write tests**

Test component renders:

- URL input field
- Crawl mode selector (Standard / Exhaustive)
- Max pages input (shown for both modes)
- AI analysis toggle (default on)
- Sample size selector (1-10, default 5)
- "Run Audit" button
- Audit history list

**Step 2-5: Implement**

Single page with:

- URL input with validation
- Crawl mode radio buttons
- Configuration options
- Submit calls `startAudit()` server action
- Redirects to audit detail page on success
- Below: audit history list (reuse `audit-history-list.tsx` pattern, update for unified audit type)

**Commit message:** `feat(audit): implement unified audit creation page with crawl mode options`

---

### Task 6.2: Build Progress Display Component

**Files:**

- Create: `components/audit/unified-progress.tsx`
- Test: `tests/unit/components/audit/unified-progress.test.tsx`

**Step 1: Write tests**

Test renders:

- Phase 1 (Crawling) status with page count
- Phase 2 workstreams (Checks, PSI, AI) each with status and counts
- Phase 3 (Scoring) status
- Awaiting confirmation state with "Continue" / "Stop" buttons
- Completed state with scores

**Step 2-5: Implement**

Component polls `getAuditProgress()` every 2 seconds (existing polling pattern). Displays the phased progress tree from the design doc.

**Commit message:** `feat(audit): implement phased progress display component`

---

### Task 6.3: Milestone 6 Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

```bash
git commit -m "chore: milestone 6 — audit creation and progress display complete"
```

---

## Milestone 7: UI — Tabbed Audit View

### Task 7.1: Build Overview Tab

**Files:**

- Create: `app/(authenticated)/seo/audit/[id]/page.tsx`
- Create: `app/(authenticated)/seo/audit/[id]/client.tsx`
- Create: `components/audit/unified-overview.tsx`
- Test: `tests/unit/components/audit/unified-overview.test.tsx`

**Step 1: Write tests**

Test renders:

- Overall score ring (reuse `score-ring.tsx`)
- Three score cards (SEO, Performance, AI Readiness) with status badges
- Top 10 critical issues
- Quick stats (pages crawled, checks, pass/fail/warning)
- Audit metadata (domain, date, duration)

**Step 2-5: Implement**

The main audit detail page wraps tabs. Overview is the default. Uses existing components where possible:

- `score-ring.tsx` from `components/reports/`
- `score-cards.tsx` from `components/audit/` (adapt for 3 unified scores)

**Commit message:** `feat(audit): implement unified audit overview tab`

---

### Task 7.2: Build SEO Tab

**Files:**

- Create: `components/audit/unified-seo-tab.tsx`
- Test: `tests/unit/components/audit/unified-seo-tab.test.tsx`

**Step 1: Write tests**

Test renders:

- SEO score card with trend chart (for org audits)
- Check list filtered to SEO-feeding checks
- Filters: priority, status, category
- Per-page drill-down

**Step 2-5: Implement**

Reuse `check-list.tsx` and `check-item.tsx` patterns, filtering by `feeds_scores` containing `ScoreDimension.SEO`.

**Commit message:** `feat(audit): implement SEO tab with filtered check list`

---

### Task 7.3: Build Performance Tab

**Files:**

- Create: `components/audit/unified-performance-tab.tsx`
- Test: `tests/unit/components/audit/unified-performance-tab.test.tsx`

**Step 1: Write tests**

Test renders:

- Performance score card
- Core Web Vitals visualization (LCP, INP, CLS with rating indicators)
- Lighthouse sub-scores (performance, accessibility, best practices, SEO)
- Mobile vs Desktop comparison
- Performance check results

**Step 2-5: Implement**

CWV and Lighthouse data extracted from check details JSON. Visual indicators use existing `CWVRating` enum and color classes.

**Commit message:** `feat(audit): implement Performance tab with CWV and Lighthouse visualizations`

---

### Task 7.4: Build AI Readiness Tab

**Files:**

- Create: `components/audit/unified-ai-tab.tsx`
- Create: `components/audit/ai-content-analysis.tsx`
- Create: `components/audit/platform-readiness-cards.tsx`
- Create: `components/audit/citability-highlights.tsx`
- Create: `components/audit/brand-mentions-card.tsx`
- Test: `tests/unit/components/audit/unified-ai-tab.test.tsx`

**Step 1: Write tests**

Test renders:

- Section 1: AI Readiness score + programmatic checks
- Section 2: Quality dimension scores (5 dimensions)
- Per-page AI analysis cards
- Citability passage highlights
- Platform readiness cards (5 platforms)
- Brand mention results

**Step 2-5: Implement**

This is the richest tab. Section 1 reuses check-list pattern. Section 2 is new components:

- `ai-content-analysis.tsx` — Quality dimension bar charts, per-page expandable cards
- `platform-readiness-cards.tsx` — 5 platform cards with scores, strengths, weaknesses
- `citability-highlights.tsx` — Top/bottom passages with scores and signal indicators
- `brand-mentions-card.tsx` — Wikipedia/Wikidata status with gap list

**Commit message:** `feat(audit): implement AI Readiness tab with content analysis, platform readiness, citability`

---

### Task 7.5: Wire Up Tab Navigation

**Files:**

- Modify: `app/(authenticated)/seo/audit/[id]/client.tsx`
- Test: `tests/unit/app/seo/audit/[id]/client.test.tsx`

**Step 1: Write tests**

Test:

- Default tab is Overview
- Tab switching renders correct content
- URL query param syncs with active tab (`?tab=seo`, `?tab=performance`, `?tab=ai-readiness`)
- During audit (not completed), shows progress display instead of tabs

**Step 2-5: Implement**

Use Shadcn `Tabs` component. Store active tab in URL search params for deep linking.

**Commit message:** `feat(audit): wire up tabbed navigation with URL-synced tab state`

---

### Task 7.6: Milestone 7 Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

```bash
git commit -m "chore: milestone 7 — full tabbed audit UI complete"
```

---

## Milestone 8: Navigation & Flow Integration

### Task 8.1: Update Navigation

**Files:**

- Modify: `components/navigation/` (navigation config files)
- Modify: `app/(authenticated)/seo/layout.tsx`
- Test: Visual verification

**Step 1: Update navigation config**

Replace separate Site Audit / Page Speed / AIO links with single "Audit" link pointing to `/seo/audit`.

Reference: `components/navigation/` config and `2026-03-07-navigation-restructure.md` for current nav structure.

**Step 2: Update SEO layout**

Ensure `/seo/audit` and `/seo/audit/[id]` routes work within the existing SEO layout.

**Step 3: Update Quick Audit flow**

Modify `/quick-audit` to use the unified audit creation flow (single button, creates unified audit with `organizationId: null`).

**Step 4: Commit**

```bash
git commit -m "feat(audit): update navigation — single audit entry point, update quick audit flow"
```

---

### Task 8.2: Update Cron Jobs

**Files:**

- Modify: `app/api/cron/weekly-audits/route.ts`
- Modify: `app/api/cron/audit-cleanup/route.ts`
- Test: `tests/unit/app/api/cron/unified-audit-cron.test.ts`

**Step 1: Write tests**

Test:

- Weekly audits creates unified audits instead of separate ones
- Cleanup targets unified audit tables
- Cleanup strategy: keep latest detailed, scores only for older, one-time delete after 30 days

**Step 2-5: Implement**

Update cron handlers to create `audits` records and call unified runner. Cleanup queries target `audit_checks`, `audit_pages`, `audit_ai_analyses`.

**Commit message:** `feat(audit): update cron jobs for unified audit system`

---

### Task 8.3: Update Sharing

**Files:**

- Modify sharing-related files to support `SharedResourceType.UnifiedAudit` (or similar)
- Update public share page to render unified audit data

**Step 1: Add unified audit to shared resource types**

Add to `SharedResourceType` enum in `lib/enums.ts`. Update share creation and validation.

**Step 2: Implement public view**

The shared audit view should show the Overview tab data (scores, top issues, metadata).

**Step 3: Commit**

```bash
git commit -m "feat(audit): add unified audit sharing support"
```

---

### Task 8.4: Update Report Generation

**Files:**

- Modify: `lib/reports/` — update report generation to pull from unified audit
- Modify: `app/(authenticated)/seo/reports/new/` — update report creation flow

**Step 1: Update report creation**

Instead of selecting 3 separate audits, select one unified audit. The validation is simpler — just check the unified audit is completed.

**Step 2: Update data transformation**

`transform.ts` pulls scores and checks from unified audit tables instead of 3 separate table sets.

**Step 3: Update score calculator**

`score-calculator.ts` — update `DEFAULT_SCORE_WEIGHTS` to `{ seo: 0.4, performance: 0.3, ai_readiness: 0.3 }`.

**Step 4: Commit**

```bash
git commit -m "feat(audit): update report generation to use unified audit data"
```

---

### Task 8.5: Milestone 8 Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

```bash
git commit -m "chore: milestone 8 — navigation, crons, sharing, reports updated for unified audit"
```

---

## Milestone 9: Deprecation & Final Cleanup

### Task 9.1: Add Deprecation Notices

**Files:**

- Modify: Old audit pages (`seo/site-audit/`, `seo/page-speed/`, `seo/aio/`)

Add a banner at the top of old audit pages:

> "This audit type has been replaced by the Unified Audit. [Go to Unified Audit →](/seo/audit)"

Old audit detail pages remain accessible for viewing historical data.

**Commit message:** `chore(audit): add deprecation notices to old audit pages`

---

### Task 9.2: E2E Test

**Files:**

- Create: `tests/e2e/unified-audit.spec.ts`

Write Playwright E2E test covering the critical user journey:

1. Navigate to audit page
2. Enter URL, select crawl mode, click Run Audit
3. Verify progress display appears
4. Wait for completion (with timeout)
5. Verify Overview tab shows scores
6. Switch to SEO tab, verify checks displayed
7. Switch to Performance tab, verify CWV data
8. Switch to AI Readiness tab, verify AI analysis data

**Note:** This requires local Supabase running. Use `data-testid` attributes on all interactive elements.

**Commit message:** `test(audit): add E2E test for unified audit flow`

---

### Task 9.3: Final Milestone Checkpoint

```bash
npm run lint && npm run format && npm run test:unit && npm run build
```

Run integration tests if local Supabase is available:

```bash
npm run test:integration
```

Run E2E if available:

```bash
npm run test:e2e
```

```bash
git commit -m "chore: milestone 9 — unified audit system complete, all tests passing"
```

---

## Summary

| Milestone | Description                    | Key Deliverables                                        |
| --------- | ------------------------------ | ------------------------------------------------------- |
| 1         | Database & Core Types          | Enums, type definitions, database migration             |
| 2         | Check Registry & Ported Checks | 55 checks across 10 categories, all tested              |
| 3         | Scoring Calculator             | Unified scoring with 3 dimensions + overall             |
| 4         | Execution Engine               | Unified runner with crawl → parallel analysis → scoring |
| 5         | Server Actions                 | Data layer for UI                                       |
| 6         | Audit Creation & Progress      | Creation page, progress display                         |
| 7         | Tabbed Audit View              | Overview, SEO, Performance, AI Readiness tabs           |
| 8         | Navigation & Integration       | Nav update, crons, sharing, reports                     |
| 9         | Deprecation & Cleanup          | Old page notices, E2E tests                             |

**Total new/modified files:** ~100+
**Total checks:** 55 (from 67, deduplicated)
**New checks:** 5 (citability, brand-mentions, platform-readiness, speakable-schema, schema-validation)
**Enhanced checks:** 3 (ai-crawler-access, llms-txt, organization-schema)
