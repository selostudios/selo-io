# Performance Reports Implementation Plan (Phases 0–2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Audit Report empty-screen bug, rename "Client Reports" → "Audit Reports", and stand up the foundation (schema, routes, data pipeline, snapshot/publish flow — no AI yet) for a new "Performance Reports" report type.

**Architecture:** See `docs/plans/2026-04-20-performance-reports-design.md` for the full design. Performance Reports are quarterly marketing reviews with dual (QoQ + YoY) comparisons. Data fetches from existing GA/LinkedIn/HubSpot integrations. Drafts store a working copy; publishing copies draft into an immutable snapshot row with its own share token so historical reports keep their original numbers.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS + PostgREST), TypeScript, Vitest, Playwright.

**Branch:** `performance-reports` (worktree at `.worktrees/performance-reports/`).

---

## Phase 0: Fix Audit Report empty screen + rename

**Goal:** Stop the blank-screen behaviour in the existing client reports view, surface errors instead, and rename the feature to "Audit Reports." Ship as its own PR.

### Task 0.1: Add root `error.tsx` boundary

**Files:**

- Create: `app/error.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error Boundary]', {
      type: 'unhandled',
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        An unexpected error occurred. The team has been notified.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds; no new TS errors.

**Step 3: Commit**

```bash
git add app/error.tsx
git commit -m "feat: add app-level error boundary to surface failures"
```

---

### Task 0.2: Add root `not-found.tsx`

**Files:**

- Create: `app/not-found.tsx`

**Step 1: Write the component**

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="text-sm underline">
        Go home
      </Link>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/not-found.tsx
git commit -m "feat: add app-level not-found page"
```

---

### Task 0.3: Add failing test that reproduces the empty-screen bug

**Files:**

- Create: `tests/unit/app/client-reports/transform-unified-report.test.ts`

**Step 1: Write the test**

```ts
import { describe, test, expect } from 'vitest'
import { transformToPresentation } from '@/app/(authenticated)/[orgId]/seo/client-reports/[id]/transform'
import type { GeneratedReportWithAudits } from '@/lib/reports/types'
import type { ReportAuditData } from '@/app/(authenticated)/[orgId]/seo/client-reports/actions'

describe('transformToPresentation — unified audit reports', () => {
  test('produces presentation data when legacy audit joins are missing', () => {
    // Simulates the shape we get for a unified-audit report when
    // site_audit / performance_audit / aio_audit joins return null
    const report = {
      id: 'r1',
      audit_id: 'a1',
      domain: 'example.com',
      combined_score: 74,
      created_at: '2026-04-01T00:00:00Z',
      executive_summary: null,
      custom_logo_url: null,
      custom_company_name: null,
      org_name: null,
      org_logo_url: null,
      primary_color: null,
      secondary_color: null,
      accent_color: null,
      site_audit: null,
      performance_audit: null,
      aio_audit: null,
    } as unknown as GeneratedReportWithAudits

    const auditData: ReportAuditData = {
      siteChecks: [],
      performanceResults: [],
      aioChecks: [],
    }

    expect(() => transformToPresentation(report, auditData)).not.toThrow()
  })
})
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest tests/unit/app/client-reports/transform-unified-report.test.ts --run`
Expected: FAIL with `Cannot read properties of null (reading 'overall_score')` (or similar).

**Step 3: Commit the failing test**

```bash
git add tests/unit/app/client-reports/transform-unified-report.test.ts
git commit -m "test: reproduce audit report blank-screen on null legacy joins"
```

---

### Task 0.4: Rewrite `transformToPresentation` to tolerate unified-audit data directly

The fix removes dependence on the synthesized legacy shim. Pull scores, pages, and checks from wherever they actually are: if `site_audit` / `performance_audit` / `aio_audit` are absent, fall back to `report.audit_id` being present and the `audit_checks` that `getReportAuditData` already returns.

**Files:**

- Modify: `app/(authenticated)/[orgId]/seo/client-reports/[id]/transform.ts`
- Modify: `app/(authenticated)/[orgId]/seo/client-reports/actions.ts` (remove the synthesis shim)

**Step 1: Update `transformToPresentation` signature to take the unified audit directly**

Replace the top of `transform.ts` so it reads scores from a dedicated `audit` param instead of the fake legacy objects. Update all `report.site_audit.*` / `report.performance_audit.*` / `report.aio_audit.*` references.

```ts
// transform.ts
import type { UnifiedAudit } from '@/lib/unified-audit/types'

export interface TransformInput {
  report: GeneratedReportWithAudits
  audit: Pick<
    UnifiedAudit,
    'seo_score' | 'performance_score' | 'ai_readiness_score' | 'pages_crawled'
  > | null
  auditData: ReportAuditData
}

export function transformToPresentation({
  report,
  audit,
  auditData,
}: TransformInput): ReportPresentationData {
  const seoScore = audit?.seo_score ?? 0
  const pageSpeedScore = audit?.performance_score ?? 0
  const aioScore = audit?.ai_readiness_score ?? 0
  const pagesAnalyzed = audit?.pages_crawled ?? 0
  // …rest unchanged, just replace the old field reads
}
```

**Step 2: Remove the shim from `getReportWithAudits`**

Delete the block that synthesizes fake `site_audit` / `performance_audit` / `aio_audit` on the `report` object. Instead, return a bare record + fetch the unified audit separately:

```ts
// actions.ts
export async function getReportWithAudits(reportId: string): Promise<GeneratedReportWithAudits> {
  const supabase = await createClient()
  const { data: report, error } = await supabase
    .from('generated_reports')
    .select(
      `
      *,
      organization:organizations(name, logo_url, primary_color, secondary_color, accent_color)
    `
    )
    .eq('id', reportId)
    .single()

  if (error || !report) notFound()

  const org = report.organization
  return {
    ...report,
    performance_results: [],
    org_name: org?.name ?? null,
    org_logo_url: org?.logo_url ?? null,
    primary_color: org?.primary_color ?? null,
    secondary_color: org?.secondary_color ?? null,
    accent_color: org?.accent_color ?? null,
  } as GeneratedReportWithAudits
}

export async function getUnifiedAuditForReport(auditId: string | null) {
  if (!auditId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('audits')
    .select('seo_score, performance_score, ai_readiness_score, pages_crawled')
    .eq('id', auditId)
    .single()
  return data
}
```

**Step 3: Update the page to pass the unified audit into the transform**

```ts
// page.tsx
const report = await getReportWithAudits(id)
const audit = await getUnifiedAuditForReport(report.audit_id)
const auditData = await getReportAuditData(report)
const presentationData = transformToPresentation({ report, audit, auditData })
```

**Step 4: Run the failing test**

Run: `npx vitest tests/unit/app/client-reports/transform-unified-report.test.ts --run`
Expected: PASS.

**Step 5: Run the full unit suite**

Run: `npm run test:unit`
Expected: all pass (976+).

**Step 6: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/seo/client-reports/
git commit -m "fix: derive audit report slides from unified audit, drop legacy shim"
```

---

### Task 0.5: Verify the fix against the real broken URL

**Step 1:** Start dev server, log in, visit `/71732fbe-c75a-4747-9bea-db36a550329d/seo/client-reports/8947447a-6ab6-44ab-818d-ee200aec2da5`.
Expected: slides render (or the specific data-missing check surfaces, not a blank page).

**Step 2:** Run lint + build.

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 3:** Commit any small cleanups, then stop — Phase 0 is ready to PR on its own.

---

### Task 0.6: Rename "Client Reports" → "Audit Reports" in the UI

Keep the URL as `/seo/client-reports` for now (renaming routes is a separate, riskier change due to share tokens). Only update the user-facing labels in navigation and page titles.

**Files:**

- Modify: `components/navigation/` (search for "Client Reports")
- Modify: any page titles / breadcrumbs referencing "Client Reports"

**Step 1: Grep for every occurrence**

Run: `rg "Client Reports" app components lib`

**Step 2: Replace each with "Audit Reports"**

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: all pass. Any tests that match "Client Reports" text will need updating — do so in the same commit.

**Step 4: Update any Playwright E2E that asserts on the text**

**Step 5: Commit**

```bash
git add -u
git commit -m "feat: rename Client Reports to Audit Reports in UI"
```

**Step 6: Full verification**

```bash
npm run lint && npm run test:unit && npm run build
```

Expected: all green.

---

## Phase 1: Performance Reports foundation

**Goal:** Schema migrations, enum additions, route scaffolds, and navigation entries for Performance Reports. Nothing renders real data yet — just a walking skeleton.

### Task 1.1: Migration for `marketing_reviews` table

**Files:**

- Create: `supabase/migrations/<timestamp>_marketing_reviews.sql`

Use `npx supabase migration new marketing_reviews` to get the timestamped filename.

**Step 1: Write the migration**

```sql
create table public.marketing_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  quarter text not null,  -- e.g. '2026-Q1'
  latest_snapshot_id uuid,  -- FK set after snapshots table exists
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quarter)
);

create index marketing_reviews_org_idx on public.marketing_reviews(organization_id);

alter table public.marketing_reviews enable row level security;

create policy "Org members can view marketing reviews"
  on public.marketing_reviews
  for select
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = auth.uid()
        and tm.organization_id = marketing_reviews.organization_id
    )
    or exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.is_internal = true
    )
  );

create policy "Org admins and internal users can insert marketing reviews"
  on public.marketing_reviews
  for insert
  to authenticated
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = auth.uid()
        and tm.organization_id = marketing_reviews.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_internal = true
    )
  );

create policy "Org admins and internal users can update marketing reviews"
  on public.marketing_reviews
  for update
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = auth.uid()
        and tm.organization_id = marketing_reviews.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u where u.id = auth.uid() and u.is_internal = true
    )
  );

create policy "Org admins and internal users can delete marketing reviews"
  on public.marketing_reviews
  for delete
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = auth.uid()
        and tm.organization_id = marketing_reviews.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u where u.id = auth.uid() and u.is_internal = true
    )
  );
```

**Step 2: Apply locally**

Run: `supabase db reset` (in dev shell).
Expected: migration applies cleanly.

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add marketing_reviews table + RLS"
```

---

### Task 1.2: Migration for `marketing_review_snapshots` table

**Files:**

- Create: `supabase/migrations/<timestamp>_marketing_review_snapshots.sql`

**Step 1: Write the migration**

```sql
create table public.marketing_review_snapshots (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketing_reviews(id) on delete cascade,
  version int not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references auth.users(id),

  period_start date not null,
  period_end date not null,
  compare_qoq_start date not null,
  compare_qoq_end date not null,
  compare_yoy_start date not null,
  compare_yoy_end date not null,

  data jsonb not null,       -- frozen metrics
  narrative jsonb not null,  -- frozen narrative blocks

  share_token text not null unique,

  unique (review_id, version)
);

create index marketing_review_snapshots_review_idx
  on public.marketing_review_snapshots(review_id);

-- Back-fill FK now that snapshots exists
alter table public.marketing_reviews
  add constraint marketing_reviews_latest_snapshot_fk
  foreign key (latest_snapshot_id)
  references public.marketing_review_snapshots(id)
  on delete set null;

alter table public.marketing_review_snapshots enable row level security;

-- Read policy mirrors reviews: org members + internal users
create policy "Org members can view snapshots"
  on public.marketing_review_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_snapshots.review_id
        and tm.user_id = auth.uid()
    )
    or exists (
      select 1 from users u where u.id = auth.uid() and u.is_internal = true
    )
  );

-- INSERT-only: admins and internal users. No UPDATE policy = never mutable.
create policy "Admins can insert snapshots"
  on public.marketing_review_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_snapshots.review_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u where u.id = auth.uid() and u.is_internal = true
    )
  );
```

**Step 2: Apply locally, verify.**

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add marketing_review_snapshots + immutable RLS"
```

---

### Task 1.3: Migration for `marketing_review_drafts` table

**Files:**

- Create: `supabase/migrations/<timestamp>_marketing_review_drafts.sql`

**Step 1: Write the migration**

```sql
create table public.marketing_review_drafts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.marketing_reviews(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}',
  narrative jsonb not null default '{}',
  ai_originals jsonb not null default '{}'
);

alter table public.marketing_review_drafts enable row level security;

create policy "Org members can view drafts"
  on public.marketing_review_drafts
  for select
  to authenticated
  using (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_drafts.review_id
        and tm.user_id = auth.uid()
    )
    or exists (select 1 from users u where u.id = auth.uid() and u.is_internal = true)
  );

create policy "Admins can insert/update drafts"
  on public.marketing_review_drafts
  for all
  to authenticated
  using (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_drafts.review_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = auth.uid() and u.is_internal = true)
  )
  with check (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_drafts.review_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = auth.uid() and u.is_internal = true)
  );
```

**Step 2: Apply + commit**

```bash
git add supabase/migrations/
git commit -m "feat: add marketing_review_drafts + RLS"
```

---

### Task 1.4: Add `SharedResourceType.MarketingReview` enum value

**Files:**

- Modify: `lib/enums.ts`
- Modify: `app/s/[token]/page.tsx` (dispatch table — leave handler stubbed for Phase 6)

**Step 1: Add enum value**

```ts
export enum SharedResourceType {
  Report = 'report',
  SiteAudit = 'site_audit',
  PerformanceAudit = 'performance_audit',
  AIOAudit = 'aio_audit',
  MarketingReview = 'marketing_review', // NEW
}
```

**Step 2: Stub dispatch in `app/s/[token]/page.tsx`**

Add a case for `SharedResourceType.MarketingReview` that returns `notFound()` for now. Phase 6 will wire the real view.

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: pass.

**Step 4: Commit**

```bash
git add lib/enums.ts app/s/
git commit -m "feat: reserve SharedResourceType.MarketingReview (stub handler)"
```

---

### Task 1.5: Add TypeScript types

**Files:**

- Create: `lib/reviews/types.ts`

**Step 1: Write types**

```ts
export interface MarketingReview {
  id: string
  organization_id: string
  title: string
  quarter: string // '2026-Q1'
  latest_snapshot_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface MarketingReviewSnapshot {
  id: string
  review_id: string
  version: number
  published_at: string
  published_by: string
  period_start: string
  period_end: string
  compare_qoq_start: string
  compare_qoq_end: string
  compare_yoy_start: string
  compare_yoy_end: string
  data: SnapshotData
  narrative: NarrativeBlocks
  share_token: string
}

export interface MarketingReviewDraft {
  id: string
  review_id: string
  updated_at: string
  data: SnapshotData
  narrative: NarrativeBlocks
  ai_originals: NarrativeBlocks
}

export interface SnapshotData {
  ga?: GAData
  linkedin?: LinkedInData
  hubspot?: HubSpotData
  email?: EmailData
  audit?: AuditInputData
}

export interface NarrativeBlocks {
  cover_subtitle?: string
  ga_summary?: string
  linkedin_insights?: string
  initiatives?: string
  takeaways?: string
  planning?: string
}

// Platform data shapes kept deliberately open-ended (jsonb) and narrowed later
// as the data pipeline stabilises. For now each is a record of metric → {
// current, qoq, yoy } triples.
export type GAData = Record<string, MetricTriple>
export type LinkedInData = Record<string, MetricTriple> & {
  top_posts?: LinkedInTopPost[]
}
export type HubSpotData = Record<string, MetricTriple>
export type EmailData = Record<string, MetricTriple>
export interface AuditInputData {
  audit_id: string
  seo_score: number | null
  performance_score: number | null
  ai_readiness_score: number | null
  top_failed_checks: Array<{
    id: string
    check_name: string
    display_name: string | null
    priority: string
    category: string
  }>
}

export interface MetricTriple {
  current: number
  qoq: number | null
  yoy: number | null
  qoq_delta_pct: number | null
  yoy_delta_pct: number | null
  timeseries?: {
    current: Array<{ date: string; value: number }>
    qoq: Array<{ date: string; value: number }>
    yoy: Array<{ date: string; value: number }>
  }
}

export interface LinkedInTopPost {
  id: string
  url: string | null
  thumbnail_url: string | null
  caption: string | null
  posted_at: string
  impressions: number
  reactions: number
  comments: number
  shares: number
  engagement_rate: number
}
```

**Step 2: Commit**

```bash
git add lib/reviews/types.ts
git commit -m "feat: add marketing review type definitions"
```

---

### Task 1.6: Route scaffolding

Create empty-but-rendering pages at every route. Data wiring happens in Phase 2.

**Files:**

- Create: `app/(authenticated)/[orgId]/reports/performance/page.tsx` — list
- Create: `app/(authenticated)/[orgId]/reports/performance/new/page.tsx` — create form
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx` — editor
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/page.tsx` — history
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/page.tsx` — snapshot read-only
- Create: `app/(authenticated)/[orgId]/reports/audit/page.tsx` — wrapper redirecting to existing /seo/client-reports for now (don't touch URL yet)

Each page renders a placeholder with its route name + a `data-testid` identifying it.

**Step 1: Create scaffolds**

Example for the list page:

```tsx
// app/(authenticated)/[orgId]/reports/performance/page.tsx
export const dynamic = 'force-dynamic'

export default async function PerformanceReportsListPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  return (
    <div className="p-8" data-testid="performance-reports-list">
      <h1 className="text-2xl font-semibold">Performance Reports</h1>
      <p className="text-muted-foreground text-sm">Coming soon — org {orgId}</p>
    </div>
  )
}
```

Repeat the placeholder pattern for the other four routes (different `data-testid` each).

**Step 2: Run build**

Run: `npm run build`
Expected: all five new routes compile.

**Step 3: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/
git commit -m "feat: scaffold performance reports routes"
```

---

### Task 1.7: Add navigation entries

**Files:**

- Modify: `components/navigation/` (the config that powers Home → Reports)

**Step 1: Find the Reports section**

Run: `rg -n "Client Reports|client-reports" components/navigation`

Locate the config file.

**Step 2: Update**

Replace "Client Reports" with two entries:

- **Audit Reports** → existing `/seo/client-reports` path (for now)
- **Performance Reports** → `/reports/performance`

**Step 3: Run lint + tests**

```bash
npm run lint
npm run test:unit
```

Expected: pass.

**Step 4: Commit**

```bash
git add components/navigation/
git commit -m "feat: add Performance Reports to Home navigation"
```

---

## Phase 2: Data pipeline — fetch, snapshot, publish (no AI)

**Goal:** Admin can create a Performance Report, system fetches GA/LinkedIn/HubSpot data for the chosen quarter with QoQ + YoY comparisons, stores as a draft, admin publishes, snapshot is created with a share token. Narrative is empty strings for now (Phase 3 adds AI).

### Task 2.1: Period/date-math utilities (TDD)

**Files:**

- Create: `lib/reviews/period.ts`
- Create: `tests/unit/lib/reviews/period.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, test, expect } from 'vitest'
import { parseQuarter, periodsForQuarter, currentQuarter } from '@/lib/reviews/period'

describe('parseQuarter', () => {
  test('parses 2026-Q1 to year/quarter', () => {
    expect(parseQuarter('2026-Q1')).toEqual({ year: 2026, quarter: 1 })
  })

  test('throws on malformed input', () => {
    expect(() => parseQuarter('2026-5')).toThrow()
    expect(() => parseQuarter('2026Q1')).toThrow()
  })
})

describe('periodsForQuarter', () => {
  test('Q1 2026 main period is Jan 1–Mar 31, 2026', () => {
    const p = periodsForQuarter('2026-Q1')
    expect(p.main.start).toBe('2026-01-01')
    expect(p.main.end).toBe('2026-03-31')
  })

  test('Q1 2026 prior-quarter is Q4 2025', () => {
    const p = periodsForQuarter('2026-Q1')
    expect(p.qoq.start).toBe('2025-10-01')
    expect(p.qoq.end).toBe('2025-12-31')
  })

  test('Q1 2026 year-over-year is Q1 2025', () => {
    const p = periodsForQuarter('2026-Q1')
    expect(p.yoy.start).toBe('2025-01-01')
    expect(p.yoy.end).toBe('2025-03-31')
  })

  test('Q3 2026 periods are correct', () => {
    const p = periodsForQuarter('2026-Q3')
    expect(p.main).toEqual({ start: '2026-07-01', end: '2026-09-30' })
    expect(p.qoq).toEqual({ start: '2026-04-01', end: '2026-06-30' })
    expect(p.yoy).toEqual({ start: '2025-07-01', end: '2025-09-30' })
  })
})

describe('currentQuarter', () => {
  test('returns quarter string for a given date', () => {
    expect(currentQuarter(new Date('2026-04-20'))).toBe('2026-Q2')
    expect(currentQuarter(new Date('2026-12-31'))).toBe('2026-Q4')
    expect(currentQuarter(new Date('2026-01-01'))).toBe('2026-Q1')
  })
})
```

**Step 2: Run — verify fail**

Run: `npx vitest tests/unit/lib/reviews/period.test.ts --run`
Expected: FAIL (module not found).

**Step 3: Implement**

```ts
// lib/reviews/period.ts
export interface DateRange {
  start: string // ISO date yyyy-mm-dd
  end: string
}

export interface QuarterPeriods {
  main: DateRange
  qoq: DateRange
  yoy: DateRange
}

export function parseQuarter(input: string): { year: number; quarter: number } {
  const m = input.match(/^(\d{4})-Q([1-4])$/)
  if (!m) throw new Error(`Invalid quarter: ${input}`)
  return { year: Number(m[1]), quarter: Number(m[2]) }
}

function quarterRange(year: number, quarter: number): DateRange {
  const startMonth = (quarter - 1) * 3 // 0, 3, 6, 9
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 0)) // last day of prior month
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function periodsForQuarter(quarter: string): QuarterPeriods {
  const { year, quarter: q } = parseQuarter(quarter)
  const main = quarterRange(year, q)
  const priorQ = q === 1 ? 4 : q - 1
  const priorY = q === 1 ? year - 1 : year
  const qoq = quarterRange(priorY, priorQ)
  const yoy = quarterRange(year - 1, q)
  return { main, qoq, yoy }
}

export function currentQuarter(date: Date): string {
  const year = date.getUTCFullYear()
  const q = Math.floor(date.getUTCMonth() / 3) + 1
  return `${year}-Q${q}`
}
```

**Step 4: Run — verify pass**

Run: `npx vitest tests/unit/lib/reviews/period.test.ts --run`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/reviews/period.ts tests/unit/lib/reviews/period.test.ts
git commit -m "feat: add quarterly period + QoQ/YoY date math"
```

---

### Task 2.2: Metric-triple builder (TDD)

Build a utility that, given raw time-series data for three periods, produces a `MetricTriple` (current, qoq, yoy, deltas).

**Files:**

- Create: `lib/reviews/metric-triple.ts`
- Create: `tests/unit/lib/reviews/metric-triple.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, test, expect } from 'vitest'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'

describe('buildMetricTriple', () => {
  test('sums series and computes deltas', () => {
    const t = buildMetricTriple({
      current: [100, 200, 300],
      qoq: [100, 200, 100], // 400 total
      yoy: [50, 50, 100], // 200 total
    })
    expect(t.current).toBe(600)
    expect(t.qoq).toBe(400)
    expect(t.yoy).toBe(200)
    expect(t.qoq_delta_pct).toBe(50) // (600-400)/400 = 0.5
    expect(t.yoy_delta_pct).toBe(200) // (600-200)/200 = 2.0
  })

  test('null comparison series yields null deltas', () => {
    const t = buildMetricTriple({
      current: [100],
      qoq: null,
      yoy: null,
    })
    expect(t.qoq).toBe(null)
    expect(t.yoy).toBe(null)
    expect(t.qoq_delta_pct).toBe(null)
    expect(t.yoy_delta_pct).toBe(null)
  })

  test('zero prior value yields null delta (avoid divide-by-zero)', () => {
    const t = buildMetricTriple({
      current: [100],
      qoq: [0],
      yoy: [0],
    })
    expect(t.qoq_delta_pct).toBe(null)
    expect(t.yoy_delta_pct).toBe(null)
  })
})
```

**Step 2: Implement**

```ts
import type { MetricTriple } from '@/lib/reviews/types'

export interface MetricTripleInput {
  current: number[]
  qoq: number[] | null
  yoy: number[] | null
}

export function buildMetricTriple(input: MetricTripleInput): MetricTriple {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const current = sum(input.current)
  const qoq = input.qoq ? sum(input.qoq) : null
  const yoy = input.yoy ? sum(input.yoy) : null
  const deltaPct = (prior: number | null): number | null => {
    if (prior === null || prior === 0) return null
    return Math.round(((current - prior) / prior) * 100 * 10) / 10
  }
  return {
    current,
    qoq,
    yoy,
    qoq_delta_pct: deltaPct(qoq),
    yoy_delta_pct: deltaPct(yoy),
  }
}
```

**Step 3: Verify pass + commit**

```bash
npx vitest tests/unit/lib/reviews/metric-triple.test.ts --run
git add lib/reviews/metric-triple.ts tests/unit/lib/reviews/metric-triple.test.ts
git commit -m "feat: add metric-triple builder for quarterly reports"
```

---

### Task 2.3: Platform data fetchers

Build one fetcher per platform. Each takes `organization_id`, `QuarterPeriods`, returns a platform-specific subset of `SnapshotData`.

**Files:**

- Create: `lib/reviews/fetchers/ga.ts`
- Create: `lib/reviews/fetchers/linkedin.ts`
- Create: `lib/reviews/fetchers/hubspot.ts`
- Create: `lib/reviews/fetchers/audit.ts`
- Create: `lib/reviews/fetchers/index.ts` (barrel + `fetchAll` composition)

Each fetcher queries the existing `platform_metrics` / `audit_checks` tables. Reuse helpers from `lib/metrics/` where possible.

**Step 1: GA fetcher (example)**

```ts
// lib/reviews/fetchers/ga.ts
import type { QuarterPeriods } from '@/lib/reviews/period'
import type { GAData } from '@/lib/reviews/types'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'
import { createServiceClient } from '@/lib/supabase/server'

const GA_METRICS = [
  'ga_active_users',
  'ga_new_users',
  'ga_sessions',
  'ga_traffic_direct',
  'ga_traffic_organic_search',
  'ga_traffic_organic_social',
  'ga_traffic_referral',
  'ga_traffic_email',
] as const

export async function fetchGAData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<GAData> {
  const supabase = createServiceClient()

  const fetchSeries = async (start: string, end: string) => {
    const { data } = await supabase
      .from('platform_metrics')
      .select('metric_type, metric_date, value')
      .eq('organization_id', organizationId)
      .in('metric_type', GA_METRICS as unknown as string[])
      .gte('metric_date', start)
      .lte('metric_date', end)
    return data ?? []
  }

  const [main, qoq, yoy] = await Promise.all([
    fetchSeries(periods.main.start, periods.main.end),
    fetchSeries(periods.qoq.start, periods.qoq.end),
    fetchSeries(periods.yoy.start, periods.yoy.end),
  ])

  const result: GAData = {}
  for (const metric of GA_METRICS) {
    const seriesFor = (rows: typeof main) =>
      rows.filter((r) => r.metric_type === metric).map((r) => Number(r.value))
    result[metric] = buildMetricTriple({
      current: seriesFor(main),
      qoq: seriesFor(qoq),
      yoy: seriesFor(yoy),
    })
  }
  return result
}
```

**Step 2: LinkedIn fetcher (minus top posts — Phase 5)**

Similar shape; metric list = `LINKEDIN_METRICS`. `top_posts` returns `[]` for now and is filled by the LinkedIn spike in Phase 5.

**Step 3: HubSpot fetcher**

Similar shape. Email data derived from the same source if HubSpot adapter exposes email metrics; otherwise return `{}` and leave Email slide empty (log warning).

**Step 4: Audit fetcher**

Queries the latest completed unified audit for the org, returns scores + top 5 failed critical checks for Takeaways input.

```ts
// lib/reviews/fetchers/audit.ts
import type { AuditInputData } from '@/lib/reviews/types'
import { createServiceClient } from '@/lib/supabase/server'
import { UnifiedAuditStatus, CheckStatus, CheckPriority } from '@/lib/enums'

export async function fetchAuditData(organizationId: string): Promise<AuditInputData | null> {
  const supabase = createServiceClient()
  const { data: audit } = await supabase
    .from('audits')
    .select('id, seo_score, performance_score, ai_readiness_score')
    .eq('organization_id', organizationId)
    .eq('status', UnifiedAuditStatus.Completed)
    .not('overall_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!audit) return null

  const { data: checks } = await supabase
    .from('audit_checks')
    .select('id, check_name, display_name, priority, category')
    .eq('audit_id', audit.id)
    .eq('status', CheckStatus.Failed)
    .eq('priority', CheckPriority.Critical)
    .limit(5)

  return {
    audit_id: audit.id,
    seo_score: audit.seo_score,
    performance_score: audit.performance_score,
    ai_readiness_score: audit.ai_readiness_score,
    top_failed_checks: checks ?? [],
  }
}
```

**Step 5: Composition**

```ts
// lib/reviews/fetchers/index.ts
import type { QuarterPeriods } from '@/lib/reviews/period'
import type { SnapshotData } from '@/lib/reviews/types'
import { fetchGAData } from './ga'
import { fetchLinkedInData } from './linkedin'
import { fetchHubSpotData, fetchEmailData } from './hubspot'
import { fetchAuditData } from './audit'

export async function fetchAllData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<SnapshotData> {
  const [ga, linkedin, hubspot, email, audit] = await Promise.all([
    fetchGAData(organizationId, periods).catch(() => undefined),
    fetchLinkedInData(organizationId, periods).catch(() => undefined),
    fetchHubSpotData(organizationId, periods).catch(() => undefined),
    fetchEmailData(organizationId, periods).catch(() => undefined),
    fetchAuditData(organizationId).catch(() => undefined),
  ])
  return {
    ...(ga && { ga }),
    ...(linkedin && { linkedin }),
    ...(hubspot && { hubspot }),
    ...(email && { email }),
    ...(audit && { audit }),
  }
}
```

**Step 6: Integration test**

Write an integration test that seeds `platform_metrics` rows for a fake org across three periods, runs `fetchAllData`, and asserts the triples have expected current/qoq/yoy values. (See `tests/integration/` existing patterns.)

**Step 7: Commit after each fetcher**

```bash
git add lib/reviews/fetchers/
git commit -m "feat: platform data fetchers for quarterly reviews"
```

---

### Task 2.4: Review + draft creation server actions

**Files:**

- Create: `lib/reviews/actions.ts`

**Step 1: Implement `createReview`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { periodsForQuarter } from '@/lib/reviews/period'
import { fetchAllData } from '@/lib/reviews/fetchers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createReview(input: {
  organizationId: string
  quarter: string // '2026-Q3'
  title?: string
}): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) return { success: false, error: 'User not found' }

  const isAdmin = userRecord.role === UserRole.Admin
  const isInternal = isInternalUser(userRecord)
  if (!isAdmin && !isInternal) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const title = input.title ?? `${input.quarter} Marketing Review`

  const { data: review, error: reviewError } = await supabase
    .from('marketing_reviews')
    .insert({
      organization_id: input.organizationId,
      quarter: input.quarter,
      title,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (reviewError || !review) {
    return { success: false, error: reviewError?.message ?? 'Failed to create review' }
  }

  const periods = periodsForQuarter(input.quarter)
  const data = await fetchAllData(input.organizationId, periods)

  const { error: draftError } = await supabase.from('marketing_review_drafts').insert({
    review_id: review.id,
    data,
    narrative: {},
    ai_originals: {},
  })

  if (draftError) {
    return { success: false, error: draftError.message }
  }

  revalidatePath(`/${input.organizationId}/reports/performance`)
  return { success: true, reviewId: review.id }
}
```

**Step 2: Implement `refreshDraftData`, `updateNarrative`, `publishReview`**

See snippets below. Keep each function <50 lines; extract helpers if needed.

```ts
export async function refreshDraftData(reviewId: string) {
  // Load review to get org + quarter, re-fetch, update draft.data
}

export async function updateNarrative(reviewId: string, block: string, value: string) {
  // Merge into draft.narrative
}

export async function publishReview(reviewId: string) {
  // 1. Load draft + review
  // 2. Compute next version
  // 3. Generate share_token (crypto.randomUUID() for now)
  // 4. Insert snapshot
  // 5. Update review.latest_snapshot_id
}
```

**Step 3: Commit**

```bash
git add lib/reviews/actions.ts
git commit -m "feat: review CRUD + draft/publish server actions"
```

---

### Task 2.5: Integration tests for publish → snapshot immutability

**Files:**

- Create: `tests/integration/reviews/publish-snapshot.test.ts`

**Test cases:**

1. Creating a review + publishing produces a snapshot with matching data.
2. Publishing twice creates two snapshots with `version` 1 and 2.
3. Refreshing the draft after publish does NOT modify the earlier snapshot.
4. The share_token is unique across snapshots.

(Follow the existing pattern in `tests/integration/` — spin up local Supabase, seed fixtures, call server actions.)

**Commit:**

```bash
git add tests/integration/reviews/
git commit -m "test: publish → immutable snapshot integration tests"
```

---

### Task 2.6: Minimal list + create UI

**Files:**

- Modify: `app/(authenticated)/[orgId]/reports/performance/page.tsx` (list)
- Modify: `app/(authenticated)/[orgId]/reports/performance/new/page.tsx` (create form)

List shows a table of reviews with quarter, title, latest snapshot date, status badge. "New Review" button links to `new`. Create form is quarter dropdown + submit button.

Both components use plain Tailwind + existing shadcn primitives. No new aesthetic system yet (that lands in Phase 4).

**Commit after each:**

```bash
git commit -m "feat: performance reports list + create form"
```

---

### Task 2.7: Final Phase 2 verification

Run full checklist:

```bash
npm run lint
npm run test:unit
npm run build
```

All must be green. If any visual changes landed, also run `npx playwright test tests/e2e/visual.spec.ts`.

**Then open Phase 2 PR** — merge into `performance-reports` branch (or main, team's call).

---

## Out of scope for this plan (Phases 3–7)

- AI narrative generators (Phase 3)
- Slide components + aesthetic (Phase 4)
- LinkedIn post-level integration (Phase 5)
- Public share view (Phase 6)
- Full visual + E2E coverage (Phase 7)

Each will get its own plan doc when we get there.
