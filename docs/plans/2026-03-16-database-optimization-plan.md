# Database Optimization Plan: Migrate RLS to team_members & Query Performance

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the migration from legacy `users.organization_id`/`users.role` columns to `team_members` as the single source of truth. Rewrite 16 RLS policies, remove dual-writes, migrate application-layer reads, and optimize query performance (parallelization, batch inserts, narrow selects).

**Context:** The `team_members` table is already the primary source of truth for organization membership. The legacy `users.organization_id` and `users.role` columns exist only because ~16 RLS policies still reference them. Helper functions `get_user_organization_id()` and `is_internal_user()` already read from `team_members`/`users.is_internal`. After this migration, the legacy columns can be dropped in a future migration.

**Existing helpers:**

- `get_user_organization_id()` - reads org_id from `team_members`, SECURITY DEFINER, STABLE
- `is_internal_user()` - checks `users.is_internal = true`, SECURITY DEFINER, STABLE
- `is_internal_admin()` - checks is_internal AND role='admin' via team_members join
- `is_developer()` - checks `users.role = 'developer'` (NEEDS UPDATE)

---

## Task 1: SQL Migration — Create Helper Function & Rewrite RLS Policies

**Files:**

- Create: `supabase/migrations/20260316000000_migrate_rls_to_team_members.sql`

This is the critical migration. It creates a `get_user_role()` helper, updates `is_developer()`, and rewrites all 16 RLS policies that currently reference `users.organization_id` or `users.role`.

**Step 1: Create the migration file with the new helper function**

Create `supabase/migrations/20260316000000_migrate_rls_to_team_members.sql`:

```sql
-- =============================================================================
-- Migration: Rewrite RLS policies from users.organization_id/role to team_members
-- =============================================================================
-- This migration creates a get_user_role() helper and rewrites 16 RLS policies
-- to use team_members (via helper functions) instead of the legacy users columns.
-- After this migration, users.organization_id and users.role are no longer read
-- by any RLS policy and can be dropped in a future migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New helper: get_user_role()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.team_members
  WHERE user_id = (SELECT auth.uid())
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 2. Update is_developer() to use is_internal instead of users.role
-- -----------------------------------------------------------------------------
-- is_developer() was checking users.role = 'developer', but "developer" is an
-- internal-only role. All internal users should have equivalent access, so we
-- align this with is_internal_user().
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  );
$$;

-- =============================================================================
-- 3. Rewrite RLS policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations (1 policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
CREATE POLICY "Admins can update their organization" ON organizations
  FOR UPDATE USING (
    (SELECT get_user_role()) = 'admin'
    AND (SELECT get_user_organization_id()) = id
  );

-- -----------------------------------------------------------------------------
-- invites (4 policies)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view invites" ON invites;
CREATE POLICY "Users can view invites" ON invites
  FOR SELECT USING (
    email = (SELECT auth.email())
    OR (
      organization_id = (SELECT get_user_organization_id())
      AND (SELECT get_user_role()) = 'admin'
    )
    OR (SELECT is_internal_user())
  );

DROP POLICY IF EXISTS "Admins can insert invites" ON invites;
CREATE POLICY "Admins can insert invites" ON invites
  FOR INSERT WITH CHECK (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) = 'admin'
  );

DROP POLICY IF EXISTS "Users can update their own invites" ON invites;
CREATE POLICY "Users can update their own invites" ON invites
  FOR UPDATE USING (
    email = (SELECT auth.email())
    OR (
      organization_id = (SELECT get_user_organization_id())
      AND (SELECT get_user_role()) = 'admin'
    )
    OR (SELECT is_internal_user())
  );

DROP POLICY IF EXISTS "Admins can delete invites" ON invites;
CREATE POLICY "Admins can delete invites" ON invites
  FOR DELETE USING (
    (
      organization_id = (SELECT get_user_organization_id())
      AND (SELECT get_user_role()) = 'admin'
    )
    OR (SELECT is_internal_user())
  );

-- -----------------------------------------------------------------------------
-- campaigns (3 policies)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and team members can insert campaigns" ON campaigns;
CREATE POLICY "Admins and team members can insert campaigns" ON campaigns
  FOR INSERT WITH CHECK (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) IN ('admin', 'team_member')
  );

DROP POLICY IF EXISTS "Admins and team members can update campaigns" ON campaigns;
CREATE POLICY "Admins and team members can update campaigns" ON campaigns
  FOR UPDATE USING (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) IN ('admin', 'team_member')
  );

DROP POLICY IF EXISTS "Admins and team members can delete campaigns" ON campaigns;
CREATE POLICY "Admins and team members can delete campaigns" ON campaigns
  FOR DELETE USING (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) IN ('admin', 'team_member')
  );

-- -----------------------------------------------------------------------------
-- platform_connections (3 policies)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert platform connections" ON platform_connections;
CREATE POLICY "Admins can insert platform connections" ON platform_connections
  FOR INSERT WITH CHECK (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update platform connections" ON platform_connections;
CREATE POLICY "Admins can update platform connections" ON platform_connections
  FOR UPDATE USING (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can delete platform connections" ON platform_connections;
CREATE POLICY "Admins can delete platform connections" ON platform_connections
  FOR DELETE USING (
    (SELECT get_user_organization_id()) = organization_id
    AND (SELECT get_user_role()) = 'admin'
  );

-- -----------------------------------------------------------------------------
-- campaign_metrics (1 policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view org-level metrics" ON campaign_metrics;
CREATE POLICY "Users can view org-level metrics" ON campaign_metrics
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    OR (SELECT is_internal_user())
  );

-- -----------------------------------------------------------------------------
-- feedback (2 policies)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and developers can view all feedback" ON feedback;
CREATE POLICY "Admins and developers can view all feedback" ON feedback
  FOR SELECT USING (
    (SELECT is_internal_user())
  );

DROP POLICY IF EXISTS "Admins and developers can update feedback" ON feedback;
CREATE POLICY "Admins and developers can update feedback" ON feedback
  FOR UPDATE USING (
    (SELECT is_internal_user())
  );

-- -----------------------------------------------------------------------------
-- storage.objects (1 policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and developers can read all screenshots" ON storage.objects;
CREATE POLICY "Admins and developers can read all screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'screenshots'
    AND (SELECT is_internal_user())
  );

-- -----------------------------------------------------------------------------
-- performance_audit_results (1 policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their organization's and own performance results" ON performance_audit_results;
CREATE POLICY "Users can view their organization's and own performance results" ON performance_audit_results
  FOR SELECT USING (
    audit_id IN (
      SELECT pa.id FROM performance_audits pa
      WHERE pa.organization_id = (SELECT get_user_organization_id())
        OR (pa.organization_id IS NULL AND pa.created_by = (SELECT auth.uid()))
    )
    OR (SELECT is_internal_user())
  );

-- =============================================================================
-- 4. Add missing index
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_ai_analyses_audit_id ON audit_ai_analyses(audit_id);
```

**Step 2: Test the migration locally**

Run:

```bash
supabase db reset
```

Expected: Migration applies cleanly, all policies recreated.

**Step 3: Verify RLS policies work**

Run the integration tests to validate:

```bash
npm run test:integration
```

Expected: All existing tests pass — the policies enforce the same access rules, just read from `team_members` instead of `users`.

**Commit:**

```
feat(db): rewrite 16 RLS policies to use team_members via helper functions

Adds get_user_role() helper and updates is_developer() to use is_internal.
All RLS policies now read org/role from team_members instead of legacy
users.organization_id/users.role columns. Adds missing index on
audit_ai_analyses.audit_id.
```

---

## Task 2: Migrate Legacy Application-Layer Reads to team_members

**Files:**

- Edit: `lib/organizations/actions.ts`
- Edit: `lib/share/actions.ts`
- Edit: `lib/platforms/linkedin/actions.ts`
- Edit: `lib/platforms/hubspot/actions.ts`
- Edit: `lib/platforms/google-analytics/actions.ts`
- Edit: `app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx`
- Edit: `app/api/unified-audit/[id]/status/route.ts`
- Edit: `app/api/unified-audit/[id]/stop/route.ts`
- Edit: `app/api/unified-audit/[id]/confirm-continue/route.ts`

These files read `organization_id`, `role`, or `is_internal` directly from the `users` table. They need to read from `team_members` via a join (matching the pattern in `lib/actions/with-auth.ts`), or switch to using `withAuth()` where possible.

**Pattern for files that CAN switch to `withAuth()`:**

Many of these files manually do `supabase.auth.getUser()` then query `users` for org/role. If they are server actions, they should switch to `withAuth()` which already reads from `team_members`.

**Pattern for files that CANNOT use `withAuth()` (API routes, RSC pages):**

Replace the users query with a join:

```typescript
// BEFORE:
const { data: userRecord } = await supabase
  .from('users')
  .select('organization_id, is_internal, role')
  .eq('id', user.id)
  .single()

// AFTER:
const { data: rawUser } = await supabase
  .from('users')
  .select('id, is_internal, team_members(organization_id, role)')
  .eq('id', user.id)
  .single()

const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
const userRecord = {
  organization_id: membership?.organization_id ?? null,
  role: membership?.role ?? 'client_viewer',
  is_internal: rawUser?.is_internal ?? false,
}
```

**Step 1: Update `lib/organizations/actions.ts` — `getCurrentUser()`**

This function reads `organization_id` directly from users. Update it to read via team_members:

```typescript
// BEFORE (line 55-59):
const { data: userRecord } = await supabase
  .from('users')
  .select('id, is_internal, organization_id')
  .eq('id', user.id)
  .single()

// AFTER:
const { data: rawUser } = await supabase
  .from('users')
  .select('id, is_internal, team_members(organization_id, role)')
  .eq('id', user.id)
  .single()

if (!rawUser) {
  return null
}

const membership = (rawUser.team_members as { organization_id: string; role: string }[])?.[0]

return {
  id: rawUser.id,
  isInternal: rawUser.is_internal === true,
  organizationId: membership?.organization_id ?? null,
}
```

**Step 2: Update `lib/share/actions.ts` — `createSharedLink()`**

```typescript
// BEFORE (line 102-106):
const { data: userRecord } = await supabase
  .from('users')
  .select('organization_id')
  .eq('id', user.id)
  .single()

// ... later: userRecord?.organization_id ?? null

// AFTER:
const { data: rawUser } = await supabase
  .from('users')
  .select('id, team_members(organization_id)')
  .eq('id', user.id)
  .single()

const membership = (rawUser?.team_members as { organization_id: string }[])?.[0]

// ... later: membership?.organization_id ?? null
```

**Step 3: Update `app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx`**

```typescript
// BEFORE (line 19-23):
const { data: userRecord } = await supabase
  .from('users')
  .select('organization_id, role, is_internal')
  .eq('id', user!.id)
  .single()

// AFTER:
const { data: rawUser } = await supabase
  .from('users')
  .select('id, is_internal, team_members(organization_id, role)')
  .eq('id', user!.id)
  .single()

const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
const userRecord = rawUser
  ? {
      organization_id: membership?.organization_id ?? null,
      role: membership?.role ?? 'client_viewer',
      is_internal: rawUser.is_internal,
    }
  : null
```

**Step 4: Update API routes — unified-audit status/stop/confirm-continue**

All three follow the same pattern. For each file:

`app/api/unified-audit/[id]/status/route.ts`:

```typescript
// BEFORE (line 24-28):
const { data: userRecord } = await supabase
  .from('users')
  .select('organization_id, is_internal, role')
  .eq('id', user.id)
  .single()

// AFTER:
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
```

Apply the same pattern to:

- `app/api/unified-audit/[id]/stop/route.ts` (line 18-23)
- `app/api/unified-audit/[id]/confirm-continue/route.ts` (find the same pattern)

**Step 5: Update platform integration actions**

For `lib/platforms/linkedin/actions.ts`, `lib/platforms/hubspot/actions.ts`, and `lib/platforms/google-analytics/actions.ts`:

Each file has functions that query `users.organization_id`. Read each file to find all occurrences and update them. The pattern is the same:

```typescript
// BEFORE:
const { data: userRecord } = await supabase
  .from('users')
  .select('organization_id')
  .eq('id', user.id)
  .single()
const orgId = userRecord?.organization_id

// AFTER:
const { data: rawUser } = await supabase
  .from('users')
  .select('id, team_members(organization_id)')
  .eq('id', user.id)
  .single()
const orgId = (rawUser?.team_members as { organization_id: string }[])?.[0]?.organization_id ?? null
```

**Step 6: Verify**

```bash
npm run lint && npm run test:unit && npm run build
```

Expected: All checks pass.

**Commit:**

```
refactor: migrate application-layer reads from users.org_id/role to team_members

Updates ~15 files that were reading organization_id or role directly from
the users table. Now reads via team_members join, matching the pattern
already used by withAuth().
```

---

## Task 3: Remove Dual-Writes to users.organization_id and users.role

**Files:**

- Edit: `app/auth/callback/route.ts`
- Edit: `app/onboarding/actions.ts`
- Edit: `app/accept-invite/[id]/actions.ts`
- Edit: `scripts/add-user.ts`

After Task 1 (RLS migrated) and Task 2 (reads migrated), nothing reads from `users.organization_id` or `users.role` anymore. Remove the writes.

**Step 1: Remove dual-write from `app/auth/callback/route.ts`**

Delete lines 109-117 (the `users.upsert` call with the comment "required until RLS policies migrated"):

```typescript
// DELETE THIS BLOCK (lines 109-117):
// Sync users table (required until RLS policies on other tables are migrated to team_members)
await supabase.from('users').upsert(
  {
    id: user.id,
    organization_id: invite.organization_id,
    role: invite.role,
  },
  { onConflict: 'id' }
)
```

The `team_members.upsert` on lines 94-101 is the correct write and stays.

**Step 2: Update `app/onboarding/actions.ts`**

Change the `users.insert` to only include `id` (the row is still needed for `is_internal`, `first_name`, `last_name`, etc.):

```typescript
// BEFORE (lines 88-92):
const { error: userRecordError } = await supabase.from('users').insert({
  id: user.id,
  organization_id: org.id,
  role: UserRole.Admin,
})

// AFTER:
const { error: userRecordError } = await supabase.from('users').insert({
  id: user.id,
})
```

The `team_members.insert` on lines 110-114 already writes the correct org_id and role.

Also remove the `UserRole` import if it's no longer used in this file (check first — it may be used by the `team_members.insert`). The `team_members.insert` on line 113 uses `UserRole.Admin`, so keep the import.

**Step 3: Remove dual-write from `app/accept-invite/[id]/actions.ts`**

Delete lines 119-127 (the `users.upsert` call with the comment "required until RLS policies migrated"):

```typescript
// DELETE THIS BLOCK (lines 119-127):
// Sync users table (required until RLS policies on other tables are migrated to team_members)
await supabase.from('users').upsert(
  {
    id: user.id,
    organization_id: invite.organization_id,
    role: invite.role,
  },
  { onConflict: 'id' }
)
```

The `team_members.upsert` on lines 101-108 is the correct write and stays.

**Step 4: Update `scripts/add-user.ts`**

Remove `organization_id` and `role` from the users insert:

```typescript
// BEFORE (lines 113-118):
const { error: userError } = await supabase.from('users').insert({
  id: authData.user.id,
  organization_id: orgData.id,
  role: 'admin',
  ...(internal ? { is_internal: true } : {}),
})

// AFTER:
const { error: userError } = await supabase.from('users').insert({
  id: authData.user.id,
  ...(internal ? { is_internal: true } : {}),
})
```

The `team_members.insert` on lines 130-134 already writes the correct org_id and role.

**Step 5: Verify**

```bash
npm run lint && npm run test:unit && npm run build
```

Expected: All checks pass.

**Commit:**

```
refactor: remove dual-writes to legacy users.organization_id and users.role

Now that RLS policies and application reads use team_members, the
parallel writes to users.organization_id and users.role are no longer
needed. The users table row is still created for is_internal and
profile fields.
```

---

## Task 4: Parallelize Sequential Queries

**Files:**

- Edit: `app/s/[token]/actions.ts`
- Edit: `lib/actions/audit-list-helpers.ts`

**Step 1: Parallelize report data queries in `app/s/[token]/actions.ts`**

In `getSharedReportData()` (lines 125-140), three queries run sequentially after fetching the report. Wrap them in `Promise.all()`:

```typescript
// BEFORE (lines 125-140):
const { data: performanceResults } = await supabase
  .from('performance_audit_results')
  .select('*')
  .eq('audit_id', report.performance_audit_id)

const { data: siteChecks } = await supabase
  .from('site_audit_checks')
  .select('*')
  .eq('audit_id', report.site_audit_id)
  .order('created_at', { ascending: true })

const { data: aioChecks } = await supabase
  .from('aio_checks')
  .select('*')
  .eq('audit_id', report.aio_audit_id)
  .order('created_at', { ascending: true })

// AFTER:
const [{ data: performanceResults }, { data: siteChecks }, { data: aioChecks }] = await Promise.all(
  [
    supabase
      .from('performance_audit_results')
      .select('*')
      .eq('audit_id', report.performance_audit_id),
    supabase
      .from('site_audit_checks')
      .select('*')
      .eq('audit_id', report.site_audit_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('aio_checks')
      .select('*')
      .eq('audit_id', report.aio_audit_id)
      .order('created_at', { ascending: true }),
  ]
)
```

**Step 2: Parallelize sequential `.in()` queries in `lib/actions/audit-list-helpers.ts`**

In `getPerformanceAuditListData()` (lines 239-286), the `firstUrls` and `avgScores` queries are independent when both `oneTimeAuditIds` and `completedAuditIds` are non-empty. Wrap them:

```typescript
// BEFORE (lines 239-286): Two sequential blocks with .in() queries

// AFTER: Run both in parallel when both have IDs
const [firstUrlsMap, avgScoresMap] = await Promise.all([
  // First URLs for one-time audits
  (async () => {
    if (oneTimeAuditIds.length === 0) return {} as Record<string, string>
    const { data: firstUrls } = await supabase
      .from('performance_audit_results')
      .select('audit_id, url')
      .in('audit_id', oneTimeAuditIds)
      .order('created_at', { ascending: true })

    if (!firstUrls) return {} as Record<string, string>
    return firstUrls.reduce(
      (acc, result) => {
        if (!acc[result.audit_id]) {
          acc[result.audit_id] = result.url
        }
        return acc
      },
      {} as Record<string, string>
    )
  })(),
  // Average scores for completed audits
  (async () => {
    if (completedAuditIds.length === 0) return {} as Record<string, number>
    const { data: results } = await supabase
      .from('performance_audit_results')
      .select('audit_id, performance_score')
      .in('audit_id', completedAuditIds)
      .not('performance_score', 'is', null)

    if (!results) return {} as Record<string, number>
    const scoresByAudit: Record<string, number[]> = {}
    for (const result of results) {
      if (!scoresByAudit[result.audit_id]) {
        scoresByAudit[result.audit_id] = []
      }
      scoresByAudit[result.audit_id].push(result.performance_score as number)
    }
    const avgMap: Record<string, number> = {}
    for (const [auditId, scores] of Object.entries(scoresByAudit)) {
      avgMap[auditId] = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    }
    return avgMap
  })(),
])
```

Also move `getOrganizationsForSelector()` (currently on line 297) into the initial `Promise.all` alongside the audits query, similar to how `getSiteAuditListData` does it on line 169:

```typescript
// BEFORE (sequential):
const { data: audits, error: auditsError } = await auditsQuery
// ... enrichment code ...
const organizations = await getOrganizationsForSelector()

// AFTER (parallel):
const [{ data: audits, error: auditsError }, organizations] = await Promise.all([
  auditsQuery,
  getOrganizationsForSelector(),
])
```

**Step 3: Verify**

```bash
npm run lint && npm run test:unit && npm run build
```

**Commit:**

```
perf: parallelize sequential database queries in shared data and audit lists

Wraps 3 sequential queries in getSharedReportData() with Promise.all().
Parallelizes the firstUrls and avgScores enrichment queries in
getPerformanceAuditListData() and moves org selector fetch into parallel.
```

---

## Task 5: Batch Inserts

**Files:**

- Edit: `lib/audit/runner.ts`
- Edit: `lib/unified-audit/batch-crawler.ts`

**Step 1: Batch site-wide check inserts in `lib/audit/runner.ts`**

Currently (lines 532-562), each site-wide check result is inserted individually inside a for-loop. Collect all results first, then batch insert:

```typescript
// BEFORE (lines 532-562):
for (const check of siteWideChecks) {
  if (isDismissed(dismissedChecks, check.name, baseUrl)) {
    continue
  }

  try {
    const result = await check.run(siteWideContext)

    const checkResult: SiteAuditCheck = {
      id: crypto.randomUUID(),
      audit_id: auditId,
      // ... all fields ...
    }

    allCheckResults.push(checkResult)
    await supabase.from('site_audit_checks').insert(checkResult) // <-- INSERT PER CHECK
  } catch (error) {
    console.error(`[Audit Finish] Site-wide check ${check.name} failed:`, error)
  }
}

// AFTER:
for (const check of siteWideChecks) {
  if (isDismissed(dismissedChecks, check.name, baseUrl)) {
    continue
  }

  try {
    const result = await check.run(siteWideContext)

    const checkResult: SiteAuditCheck = {
      id: crypto.randomUUID(),
      audit_id: auditId,
      page_id: null,
      check_type: check.type,
      check_name: check.name,
      priority: check.priority,
      status: result.status,
      details: result.details ?? null,
      created_at: new Date().toISOString(),
      display_name: check.displayName,
      display_name_passed: check.displayNamePassed,
      learn_more_url: check.learnMoreUrl,
      is_site_wide: true,
      description: check.description,
      fix_guidance: check.fixGuidance || (result.details?.message as string) || undefined,
    }

    allCheckResults.push(checkResult)
  } catch (error) {
    console.error(`[Audit Finish] Site-wide check ${check.name} failed:`, error)
  }
}

// Batch insert all site-wide check results
if (allCheckResults.length > 0) {
  await supabase.from('site_audit_checks').insert(allCheckResults)
}
```

**Step 2: Move audit record update out of per-page loop in `lib/unified-audit/batch-crawler.ts`**

Currently (lines 340-346), `pages_crawled` is updated after every page inside the while loop. Move it to after the loop:

```typescript
// BEFORE (inside the while loop, lines 340-346):
// Update pages_crawled count with timestamp
await supabase
  .from('audits')
  .update({
    pages_crawled: allPages.length,
    updated_at: new Date().toISOString(),
  })
  .eq('id', auditId)

// AFTER: Remove from inside the loop. Add after line 405 (end of while loop):
}  // end of while loop

// Update pages_crawled count once at end of batch
if (pagesProcessed > 0) {
  await supabase
    .from('audits')
    .update({
      pages_crawled: allPages.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auditId)
}
```

**Note:** The status polling endpoint (`/api/unified-audit/[id]/status`) will show a slightly less granular crawl count during a batch, but it updates between batches. This is an acceptable tradeoff for reducing N database writes to 1 per batch.

**Step 3: Verify**

```bash
npm run lint && npm run test:unit && npm run build
```

**Commit:**

```
perf: batch database inserts in audit runner and crawler

Replaces per-check INSERT in site audit runner with a single batch insert.
Moves pages_crawled UPDATE from inside per-page loop to once per batch
in the unified audit batch crawler.
```

---

## Task 6: Narrow `select('*')` in High-Traffic Paths

**Files:**

- Edit: `app/s/[token]/actions.ts`
- Edit: `lib/unified-audit/runner.ts`
- Edit: `lib/actions/audit-list-helpers.ts`
- Edit: `app/(authenticated)/[orgId]/seo/client-reports/actions.ts`
- Edit: `app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx`

Replace `select('*')` with explicit column lists in high-traffic queries. Read each file first to determine which columns are actually used downstream.

**Step 1: Narrow selects in `app/s/[token]/actions.ts`**

This is the public shared data endpoint — every shared link view hits these queries.

For `getSharedSiteAuditData()` — the audit query on line 35:

```typescript
// BEFORE:
.select('*')

// AFTER (check SiteAudit type for needed fields):
.select('id, organization_id, created_by, url, status, overall_score, seo_score, ai_readiness_score, technical_score, pages_crawled, failed_count, warning_count, passed_count, executive_summary, error_message, started_at, completed_at, created_at')
```

For `getSharedUnifiedAuditData()` — the audit query on line 172:

```typescript
// BEFORE:
.select('*')

// AFTER (check UnifiedAudit type for needed fields):
.select('id, organization_id, created_by, domain, url, status, seo_score, performance_score, ai_readiness_score, overall_score, pages_crawled, crawl_mode, max_pages, urls_discovered, sample_size, ai_analysis_enabled, passed_count, warning_count, failed_count, executive_summary, error_message, started_at, completed_at, created_at, updated_at')
```

For the paginated queries in both functions — `site_audit_checks`, `audit_checks`, `audit_pages` — read the type definitions to determine which columns are needed by the shared view components. Use explicit columns.

**Step 2: Narrow selects in `lib/unified-audit/runner.ts`**

Line 507 (`audit_checks` re-fetch after PSI):

```typescript
// BEFORE:
.select('*')

// AFTER:
.select('id, audit_id, page_url, category, check_name, priority, status, display_name, display_name_passed, description, fix_guidance, learn_more_url, details, feeds_scores, created_at')
```

Line 587 (`audit_pages` in finishUnifiedAudit):

```typescript
// BEFORE:
.select('*')

// AFTER:
.select('id, audit_id, url, title, meta_description, status_code, last_modified, is_resource, resource_type, depth, created_at')
```

Line 618 (`audit_checks` in finishUnifiedAudit):

```typescript
// Same column list as line 507 above
```

**Step 3: Narrow select in `lib/actions/audit-list-helpers.ts`**

The `generated_reports` query on line 330:

```typescript
// BEFORE:
.select('*')

// AFTER (check GeneratedReport type):
.select('id, organization_id, domain, combined_score, site_audit_id, performance_audit_id, aio_audit_id, audit_id, summary, view_count, created_at, updated_at')
```

**Step 4: Narrow select in `app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx`**

The campaigns query on line 30:

```typescript
// BEFORE:
.select('*')

// AFTER (check what CampaignCard component needs):
.select('id, organization_id, name, status, platform, start_date, end_date, budget, target_audience, notes, created_at, updated_at')
```

**Step 5: Verify**

```bash
npm run lint && npm run test:unit && npm run build
```

**Commit:**

```
perf: narrow select('*') to explicit columns in high-traffic queries

Replaces select('*') with specific column lists in shared link data
fetching, unified audit runner, audit list helpers, client reports,
and campaign page. Reduces data transfer overhead.
```

---

## Verification Checklist

After completing all 6 tasks:

1. **Run full test suite:**

   ```bash
   npm run lint && npm run test:unit && npm run build
   ```

2. **Run integration tests (requires local Supabase):**

   ```bash
   supabase db reset && npm run test:integration
   ```

3. **Manual smoke test:** Sign in as admin, team_member, client_viewer, and internal user. Verify:
   - Admin can update org settings, manage campaigns, connect platforms
   - Team member can create/edit campaigns but not manage integrations
   - Client viewer has read-only access
   - Internal user can see all organizations and audits
   - Shared links (public `/s/[token]`) still load correctly

4. **Check for remaining legacy reads** (should return zero non-doc results):

   ```bash
   grep -r "select('organization_id'" --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "docs/" | grep -v "team_members"
   ```

5. **Future cleanup** (not in this plan): Once confident the migration is stable, create a follow-up migration to `ALTER TABLE users DROP COLUMN organization_id, DROP COLUMN role`.
