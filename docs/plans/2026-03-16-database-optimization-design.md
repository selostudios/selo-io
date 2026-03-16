# Database Optimization Design

**Goal:** Migrate all RLS policies from legacy `users` columns to `team_members`-based helper functions, optimize query patterns across the codebase, and add missing indexes.

**Architecture:** Single SQL migration rewrites all RLS policies to use existing `get_user_organization_id()`, `is_internal_user()`, and `is_internal_admin()` helper functions. Application code removes dual-writes to `users.organization_id` and `users.role`. Query patterns are tightened in high-traffic paths.

---

## 1. RLS Migration

### Current State

- ~30 RLS policies across 15+ tables reference `users.organization_id` directly via nested subqueries
- Helper functions (`get_user_organization_id()`, `is_internal_user()`, `is_internal_admin()`) already exist and read from `team_members`
- Application code dual-writes to both `users` and `team_members`

### Target State

- All RLS policies use helper functions (cached per-statement, single evaluation)
- No RLS policy references `users.organization_id` or `users.role`
- Application code writes only to `team_members`
- `users.organization_id` and `users.role` columns remain (nullable, deprecated) — dropped in a follow-up

### Policy Pattern

Parent tables (direct org ownership):

```sql
-- Before:
organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
-- After:
organization_id = (SELECT get_user_organization_id()) OR (SELECT is_internal_user())
```

Child tables (join through parent):

```sql
-- Before:
audit_id IN (SELECT id FROM site_audits WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid())))
-- After:
audit_id IN (SELECT id FROM site_audits WHERE organization_id = (SELECT get_user_organization_id())) OR (SELECT is_internal_user())
```

One-time audit support (nullable org):

```sql
(organization_id = (SELECT get_user_organization_id()) OR (SELECT is_internal_user())
 OR (organization_id IS NULL AND created_by = (SELECT auth.uid())))
```

## 2. Query Performance Fixes

### Narrow `select('*')`

Replace with specific columns in:

- `app/s/[token]/actions.ts` — public shared data endpoints
- `lib/unified-audit/runner.ts` — refetches all checks/pages during analysis
- `app/(authenticated)/[orgId]/seo/client-reports/actions.ts` — report generation
- `lib/actions/audit-list-helpers.ts` — dashboard audit lists
- `app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx` — campaign list

### Parallelize Sequential Queries

Wrap in `Promise.all()`:

- `app/s/[token]/actions.ts:125-140` — 3 sequential shared report queries
- `lib/actions/audit-list-helpers.ts:240-285` — sequential `.in()` queries

### Batch Inserts

- `lib/audit/runner.ts:532-562` — site-wide checks: loop → single batch insert
- `lib/unified-audit/batch-crawler.ts` — audit record update: per-page → once per batch

## 3. Missing Indexes

Single migration adds:

- `audit_ai_analyses.audit_id` — used in RLS joins, currently unindexed

## 4. Application Code Cleanup

Remove dual-writes to `users.organization_id` and `users.role` from:

- `app/auth/callback/route.ts` — invite acceptance dual-write
- `app/onboarding/actions.ts` — org creation dual-write
- `app/accept-invite/[id]/actions.ts` — invite acceptance
- `scripts/add-user.ts` — user creation script
- Any server actions that update user role/org

## 5. Out of Scope

- Denormalized count columns (low drift risk)
- Shared link rate limiting (application-level concern)
- Enum → lookup table migration (deploy-only pain)
- Dropping `users.organization_id`/`users.role` columns (follow-up migration)
- GIN indexes on JSONB (fields never queried by content)
- `campaign_metrics` partial index (intentional change)
