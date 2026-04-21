# Audit Reports Fix + Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix the broken `/seo/client-reports/[id]` detail page, finish the rename to "Audit Reports", and move the code to `/reports/audit` so it matches the design.

**Architecture:** Two problems to solve. (1) `getReportWithAudits` joins against `aio_audits`, which was dropped in migration `20260409130000`. Every detail-page load 404s. Rip the legacy joins out of the query and the type, and strip legacy field references from `generateSummaryForReport`. (2) The previous "rename" was done backwards — `/reports/audit` was created as a stub that redirects _back to_ `/seo/client-reports`. Flip it: move the real code to `/reports/audit`, leave a 301 at `/seo/client-reports` so existing links keep working.

**Tech Stack:** Next.js App Router, Supabase (PostgREST), TypeScript, Vitest.

---

## Context for the implementer

### The bug (why detail pages 404)

`lib/supabase` PostgREST joins fail hard when the related table doesn't exist. `getReportWithAudits` in `app/(authenticated)/[orgId]/seo/client-reports/actions.ts:222` still does:

```ts
.select(`
  *,
  site_audit:site_audits(*),
  performance_audit:performance_audits(*),
  aio_audit:aio_audits(*),
  organization:organizations(...)
`)
```

`aio_audits` was dropped in `supabase/migrations/20260409130000_drop_aio_tables.sql`. PostgREST now returns an error, the `error || !report` branch fires, the page calls `notFound()`, and the user sees a 404.

`transformToPresentation` (`app/(authenticated)/[orgId]/seo/client-reports/[id]/transform.ts`) was already rewritten to read from the unified `audit` record and doesn't use `report.site_audit` / `aio_audit` / `performance_audit` anymore — so the joins are dead weight, not just broken.

The only caller left that touches the legacy fields is `generateSummaryForReport` (`actions.ts:526-582`), which uses them as fallbacks for unified-audit scores. Those fallbacks only mattered for truly legacy reports — but legacy reports have `audit_id = null` and `aio_audit_id = null`, so the fallbacks never fire in practice. They're safe to remove.

### The rename (why `/reports/audit` doesn't work)

Design doc decision #1: old `/seo/client-reports/*` → new `/reports/audit/*`, with a 301 on the old path for backwards compatibility. Phase 1 shipped a stub instead: `app/(authenticated)/[orgId]/reports/audit/page.tsx` is a two-line redirect _back to_ `/seo/client-reports`. This plan flips that direction.

### Relevant files (high-level tour)

- `app/(authenticated)/[orgId]/seo/client-reports/page.tsx` — list page (renders `ClientReportsPageData`)
- `app/(authenticated)/[orgId]/seo/client-reports/actions.ts` — data layer (list + detail + CRUD + summary generation)
- `app/(authenticated)/[orgId]/seo/client-reports/[id]/page.tsx` — detail page
- `app/(authenticated)/[orgId]/seo/client-reports/[id]/client.tsx` — detail client component
- `app/(authenticated)/[orgId]/seo/client-reports/[id]/transform.ts` — already unified, no changes needed
- `app/(authenticated)/[orgId]/reports/audit/page.tsx` — wrong-direction redirect stub, will be replaced
- `lib/reports/types.ts` — `GeneratedReportWithAudits` type (has legacy fields)
- `components/navigation/` — sidebar config (need to find the "Client Reports" label)

### Ground rules

- **Test philosophy:** per `CLAUDE.md`, we optimise for confidence in correctness, not test count. Add one integration test that would have caught the broken PostgREST join; don't add tests that re-verify the type system.
- **Quality gate:** every commit must pass `npm run lint && npm run test:unit && npm run build`. E2E (`npm run test:e2e`) should also pass before the branch is done.
- **Commits:** frequent, focused, imperative voice. Co-author line per CLAUDE.md conventions.

---

## Task 1: Reproduce the failure

**Goal:** lock in a failing test before touching code so we know the fix works.

**Files:**

- Create: `tests/integration/app/client-reports/detail-page.test.ts`

**Step 1: Write the failing test**

Write an integration test that:

1. Uses `tests/helpers/db.ts` (or the same helpers the existing integration tests use) to seed: an org, an admin user, a completed `audits` row, a `generated_reports` row linked to that audit (no legacy `site_audit_id` / `aio_audit_id` / `performance_audit_id`).
2. Calls `getReportWithAudits(reportId)` directly (it's a server action, importable from `app/(authenticated)/[orgId]/seo/client-reports/actions`).
3. Asserts the call returns a report object and does **not** throw or return null.
4. Spot-checks organization branding fields are populated (`org_name`, `primary_color`).

Mirror the structure of other integration tests under `tests/integration/` — they all boot against local Supabase and use `createClient`. Look at `tests/integration/actions/` for a template.

**Step 2: Run it to verify it fails**

```bash
npm run test:integration -- detail-page
```

Expected: FAIL. The PostgREST query will error on `aio_audits`, `getReportWithAudits` will call `notFound()` (which in a server-action context throws a `NEXT_NOT_FOUND` error), and the test will catch the throw and fail its assertion.

If the test passes unexpectedly, the bug may have been fixed in-flight. Stop and investigate before continuing — don't assume.

**Step 3: Commit**

```bash
git add tests/integration/app/client-reports/detail-page.test.ts
git commit -m "test: reproduce audit-report detail page failure

Integration test seeds a unified-audit report and asserts
getReportWithAudits returns cleanly. Currently fails because the
query joins on aio_audits, which was dropped in 20260409130000.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Strip the legacy PostgREST joins

**Goal:** make `getReportWithAudits` read only from live tables.

**Files:**

- Modify: `app/(authenticated)/[orgId]/seo/client-reports/actions.ts:222-270`

**Step 1: Rewrite the select**

Replace the current select:

```ts
const { data: report, error } = await supabase
  .from('generated_reports')
  .select(
    `
    *,
    site_audit:site_audits(*),
    performance_audit:performance_audits(*),
    aio_audit:aio_audits(*),
    organization:organizations(name, logo_url, primary_color, secondary_color, accent_color)
  `
  )
  .eq('id', reportId)
  .single()
```

With:

```ts
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
```

**Step 2: Remove the performance-results side fetch**

Lines 250-258 fetch `performance_audit_results` only when `report.performance_audit_id` is truthy. Unified reports never set that column, and the legacy path is being retired. Delete the whole `let performanceResults` block. Update the return object to drop `performance_results: performanceResults`.

**Step 3: Update the return shape**

The function currently returns `...report, performance_results, org_name, ..., primary_color, ...` cast to `GeneratedReportWithAudits`. Keep the branding flattening and the cast — we'll fix the type in Task 3.

**Step 4: Run the failing test from Task 1**

```bash
npm run test:integration -- detail-page
```

Expected: PASS.

**Step 5: Run full unit tests to check for fallout**

```bash
npm run test:unit
```

Expected: PASS. If `tests/unit/app/client-reports/transform-unified-report.test.ts` breaks, it's because the test fixture still sets legacy fields — update the fixture.

**Step 6: Commit**

```bash
git add app/(authenticated)/[orgId]/seo/client-reports/actions.ts
git commit -m "fix: remove broken legacy audit joins from getReportWithAudits

aio_audits was dropped in 20260409130000 but the query still
joined it, causing PostgREST to error on every detail-page load.
transformToPresentation has not used these joins since the
unified-audit migration, so they are dead weight.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Simplify `GeneratedReportWithAudits`

**Goal:** drop legacy fields from the type so stale code paths stop type-checking.

**Files:**

- Modify: `lib/reports/types.ts` (find `GeneratedReportWithAudits`)

**Step 1: Remove legacy optional fields from the type**

Any field like `site_audit?`, `aio_audit?`, `performance_audit?`, `performance_results?`, `site_audit_id`, `aio_audit_id`, `performance_audit_id` that is no longer used at runtime. Check with grep before deleting: `grep -rn "report\.site_audit\|report\.aio_audit\|report\.performance_audit\|site_audit_id\|aio_audit_id\|performance_audit_id" app lib components`.

Anything that shows up in live code (not tests) has to be handled before the field can leave the type. Expected remaining references after the fix:

- `generateSummaryForReport` in `actions.ts:536-565` — clean up in Task 4.
- `countReportsUsingAudit` in `actions.ts:584-597` — takes a `'site_audit' | 'performance_audit' | 'aio_audit'` literal. If no callers remain (check with grep), delete the function. If callers remain, leave the function intact — this plan does not re-architect that helper.

Do not delete `site_audit_id` / `aio_audit_id` / `performance_audit_id` from the _database_ schema. Those are columns on `generated_reports` used for the legacy-report `audit_id IS NULL` branch in the list query. Only remove them from the _app-level type_ if nothing reads them.

**Step 2: Run type check**

```bash
npm run build
```

Expected: PASS. Any type errors mean a consumer was found — handle it (usually by replacing the legacy fallback with the unified-audit path or deleting dead code).

**Step 3: Commit**

```bash
git add lib/reports/types.ts
git commit -m "refactor: drop legacy audit fields from GeneratedReportWithAudits

These fields are no longer populated since getReportWithAudits
stopped joining on the legacy audit tables.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Clean legacy fallbacks in `generateSummaryForReport`

**Goal:** make summary generation read only from the unified audit; drop dead legacy fallbacks.

**Files:**

- Modify: `app/(authenticated)/[orgId]/seo/client-reports/actions.ts:526-582`

**Step 1: Rewrite the function**

Current code has `?? report.site_audit?.overall_score ?? 0` chains. Since `report.site_audit` no longer exists, just use the unified-audit values. If the unified audit can't be fetched, fail with a clear error instead of returning zeroes.

Proposed rewrite:

```ts
export async function generateSummaryForReport(
  reportId: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const report = await getReportWithAudits(reportId)
  const unifiedAudit = await fetchUnifiedAuditScores(await createClient(), report.audit_id)

  if (!unifiedAudit) {
    return { success: false, error: 'Unified audit not found for this report' }
  }

  const auditData = await getReportAuditData(report)

  try {
    const summary = await generateReportSummary({
      domain: report.domain,
      combinedScore: report.combined_score ?? 0,
      seoScore: unifiedAudit.seo_score ?? 0,
      pageSpeedScore: unifiedAudit.performance_score ?? 0,
      aioScore: unifiedAudit.ai_readiness_score ?? 0,
      pagesAnalyzed: unifiedAudit.pages_crawled ?? 0,
      siteAudit: null,
      siteChecks: auditData.siteChecks as unknown as SiteAuditCheck[],
      performanceResults: auditData.performanceResults as unknown as PerformanceAuditResult[],
      aioAudit: null,
      aioChecks: auditData.aioChecks as unknown as AIOCheck[],
    })

    const isOriginal = !report.executive_summary
    await updateExecutiveSummary(reportId, summary, isOriginal)

    return { success: true, summary }
  } catch (error) {
    console.error('[Generate Summary Error]', {
      type: 'generation_failed',
      reportId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to generate summary' }
  }
}
```

If `generateReportSummary` doesn't accept `null` for `siteAudit` / `aioAudit`, check its signature. It probably already does because those fields were always optional — but verify by reading `lib/reports/summary-generator.ts`.

**Step 2: Run all tests**

```bash
npm run test:unit
npm run test:integration -- client-reports
```

Expected: PASS. If existing unit tests mocked `report.site_audit`, update them to not.

**Step 3: Commit**

```bash
git add app/(authenticated)/[orgId]/seo/client-reports/actions.ts
git commit -m "refactor: drop legacy score fallbacks in generateSummaryForReport

Unified-audit reports are the only supported path. If the audit
can't be fetched, return an explicit error instead of generating
a summary from zeroes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Move the detail pages to `/reports/audit`

**Goal:** physical code move. `/reports/audit` becomes the canonical route.

**Files:**

- Delete: `app/(authenticated)/[orgId]/reports/audit/page.tsx` (the wrong-direction redirect stub)
- Move: entire folder `app/(authenticated)/[orgId]/seo/client-reports/` → `app/(authenticated)/[orgId]/reports/audit/`
- Update: any `import` statements inside the moved files that used relative paths referring to `client-reports`.
- Update: any `redirect()`, `revalidatePath()`, `<Link>` calls inside the moved files that point back at `/seo/client-reports`.

**Step 1: Move the folder**

```bash
rm app/\(authenticated\)/\[orgId\]/reports/audit/page.tsx
git mv app/\(authenticated\)/\[orgId\]/seo/client-reports app/\(authenticated\)/\[orgId\]/reports/audit
```

Verify `git status` shows a rename, not a delete+add (means history is preserved).

**Step 2: Update references inside the moved code**

Grep inside the new folder:

```bash
grep -rn "seo/client-reports\|/client-reports" app/\(authenticated\)/\[orgId\]/reports/audit
```

Every match needs to flip to `/reports/audit`. Common suspects:

- `revalidatePath('/seo/client-reports')` → `revalidatePath('/reports/audit')`
- `revalidatePath(`/seo/client-reports/${reportId}`)` → `revalidatePath(`/reports/audit/${reportId}`)`
- `redirect('/seo/client-reports')` → `redirect('/reports/audit')`
- `<Link href={`/${orgId}/seo/client-reports/...`}` → `<Link href={`/${orgId}/reports/audit/...`}`

Be thorough — a single missed path will cause broken navigation on mutation.

**Step 3: Create the redirect stub at the old path**

Create `app/(authenticated)/[orgId]/seo/client-reports/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyClientReportsRedirectPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  redirect(`/${orgId}/reports/audit`)
}
```

Create `app/(authenticated)/[orgId]/seo/client-reports/[id]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyClientReportDetailRedirectPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params
  redirect(`/${orgId}/reports/audit/${id}`)
}
```

Next.js `redirect()` defaults to a 307 in App Router. For our purposes (client-side links) that's fine; search engines don't crawl authenticated routes.

**Step 4: Grep the whole codebase for stragglers**

```bash
grep -rn "seo/client-reports\|/client-reports" app components lib tests
```

Anything in `app`, `components`, `lib` that still points at the old path needs to move. In `tests`, E2E / integration tests that navigate to the old path can either update the URL or keep pointing at the old path to verify the redirect works — pick one, be explicit. Leave test file _paths_ alone for now; we'll rename those in Task 7 to keep this commit focused.

**Step 5: Full build**

```bash
npm run lint && npm run test:unit && npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move Client Reports to /reports/audit

Design doc #1 called for the old /seo/client-reports path to
redirect to /reports/audit, not the other way around. Move the
real code to /reports/audit and leave thin redirect stubs at the
old paths so existing bookmarks keep working.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Rename the nav label

**Goal:** UI copy says "Audit Reports", not "Client Reports".

**Files:**

- Modify: nav config files under `components/navigation/` (find with grep).

**Step 1: Find the label and href**

```bash
grep -rn "Client Reports\|client-reports" components/navigation
```

Two changes per match typically: the display label string and the href. Label → `Audit Reports`. Href → `/reports/audit`.

**Step 2: Check the matrix in CLAUDE.md**

`CLAUDE.md` has a Role-Based Access Matrix that mentions "Combined Reports". Don't rename that — it's a different concept. Only the "Client Reports" (formerly the sidebar entry) becomes "Audit Reports".

**Step 3: Grep for stray "Client Reports" copy**

```bash
grep -rin "client reports" app components lib
```

Update any user-facing copy. Ignore test names and comments unless they're misleading.

**Step 4: Full build + visual snapshots**

```bash
npm run lint && npm run test:unit && npm run build
```

If sidebar screenshots exist in `tests/e2e/visual.spec.ts-snapshots/`, they'll diff. After confirming the change is intentional:

```bash
npm run test:e2e:update-snapshots
```

Review the updated baseline images before committing.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename Client Reports to Audit Reports in navigation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Relocate tests and tidy up

**Goal:** test paths mirror the production paths.

**Files:**

- Move: `tests/unit/app/client-reports/` → `tests/unit/app/reports/audit/` (if test folders matter in this project; check what convention exists first with `ls tests/unit/app/`)
- Move: the integration test added in Task 1 if needed to match
- Update: any E2E tests in `tests/e2e/` that navigate to `/seo/client-reports`

**Step 1: Move unit tests**

```bash
git mv tests/unit/app/client-reports tests/unit/app/reports-audit 2>/dev/null || true
```

(Use whatever folder naming convention already exists — check siblings.)

**Step 2: Update E2E tests**

```bash
grep -rn "seo/client-reports\|/client-reports" tests/e2e
```

For each match, decide: does this test validate the new path (update the URL) or the redirect (keep the old URL and assert on the redirect target)? Usually the former — there should be one redirect-specific test and the rest hit the canonical URL.

**Step 3: Full suite**

```bash
npm run lint && npm run test:unit && npm run test:integration && npm run build
```

If E2E environment is available locally:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 4: Commit**

```bash
git add -A
git commit -m "test: relocate client-reports tests to reports/audit paths

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Final verification

**Step 1: Clean verification**

```bash
npm run lint && npm run test:unit && npm run build
```

All must pass. If anything fails, the fix is not done — no "fix in next commit" escape hatch.

**Step 2: Manual smoke in dev**

```bash
npm run dev
```

Navigate to:

- `/{orgId}/reports/audit` → list loads
- `/{orgId}/reports/audit/{reportId}` for a known unified-audit report → detail page renders with scores (not 404, not error page)
- `/{orgId}/seo/client-reports` → redirects to `/{orgId}/reports/audit`
- `/{orgId}/seo/client-reports/{reportId}` → redirects to `/{orgId}/reports/audit/{reportId}`
- Sidebar shows "Audit Reports"

**Step 3: Push & open PR**

```bash
git push -u origin audit-reports-fix
gh pr create --title "Fix Audit Reports + complete rename" --body "<see plan for summary>"
```

Monitor CI. Don't merge until green.

---

## What this plan is NOT doing

- Not dropping the legacy `site_audits` / `performance_audits` tables. They still hold historical data for legacy reports (those with `audit_id = null`). A separate migration can drop them once all legacy reports are either migrated or accepted as abandoned.
- Not touching the "Combined Reports" concept in the permissions matrix — different feature.
- Not rewriting the summary-generator signature. Passing `null` for `siteAudit` / `aioAudit` is a minimal change; a bigger cleanup belongs in its own PR.
- Not adding `data-testid` attributes to new UI (no new UI — just moves existing code).
