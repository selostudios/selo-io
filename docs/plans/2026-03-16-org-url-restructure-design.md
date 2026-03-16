# Org-in-URL Restructure Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move organization context from `?org=` query parameter to a `[orgId]` path segment so the org never falls out of sync with the view.

**Architecture:** Introduce a `[orgId]` dynamic route segment under `app/(authenticated)/` for all org-scoped routes. Middleware redirects bare routes to the user's last-used org. The org selector swaps the path segment instead of appending a query param.

**Tech Stack:** Next.js App Router dynamic segments, middleware redirects, cookie-based fallback.

---

## Problem

The current `?org=` query parameter gets lost during navigation (sidebar links, back buttons, hard-coded hrefs). The org selector desynchronizes from the view, showing data for the wrong organization.

## Design Decisions

1. **UUID in URL** — `/{orgId}/seo/audit` (no slugs, no mapping layer)
2. **Auto-redirect** — Bare `/dashboard` redirects to `/{lastOrgId}/dashboard` via cookie, or `/organizations` if no cookie
3. **Same-page org switch** — Selector replaces the orgId segment, keeps the rest of the path
4. **No backwards compat** — Old `?org=` links break cleanly (no redirect shim)
5. **Non-org routes stay top-level** — `/quick-audit`, `/app-settings`, `/organizations`

## Route Structure

```
app/(authenticated)/
  [orgId]/                      # NEW — validates UUID, provides org context
    layout.tsx                  # Auth + org access check, sets cookie, provides orgId
    dashboard/
    dashboard/campaigns/
    dashboard/campaigns/[id]/
    seo/audit/
    seo/audit/[id]/
    seo/client-reports/
    seo/client-reports/[id]/
    seo/site-audit/             # deprecated
    seo/page-speed/             # deprecated
    seo/aio/                    # deprecated
    settings/
    support/
  quick-audit/                  # no org
  app-settings/                 # no org
  organizations/                # no org
```

## Middleware

New `middleware.ts` handles:

1. **Auth check** — Existing Supabase auth verification
2. **Org redirect** — When an authenticated user hits an org-scoped path without `[orgId]`:
   - Read `selo-org` cookie → redirect to `/{cookieOrgId}/path`
   - No cookie → redirect to `/organizations`
3. **External user lock** — External users always get `/{assignedOrgId}/path`
4. **Pass-through** — Non-org routes, API routes, public routes unchanged

## `[orgId]/layout.tsx`

Single validation point for all org-scoped pages:

1. Validate UUID format (404 if invalid)
2. Confirm user access (internal = any org, external = assigned org only)
3. Update `selo-org` cookie to current orgId
4. Pass `orgId` to children (via params, no extra context needed)

## Navigation Changes

**Org selector:** Replace first UUID segment in pathname with new orgId, navigate.

**Sidebar links:** All links are `/${orgId}/seo/audit` etc. — orgId comes from route params in the layout.

**Settings tabs:** Links are `/${orgId}/settings/organization` etc.

## What Gets Deleted

- `resolveOrganizationId()` in `lib/auth/resolve-org.ts`
- `useBuildOrgHref()` hook
- `useOrgId()` hook (or simplified to just read from path)
- `searchParams.org` handling in every page
- Org param preservation logic in sidebar, navigation shell, settings tabs
- `LAST_ORG_KEY` localStorage usage

## Files Affected (~50 files)

### Core (5 files)
- `hooks/use-org-context.tsx` — Rewrite or delete
- `lib/auth/resolve-org.ts` — Delete
- `components/shared/org-selector.tsx` — Rewrite navigation logic
- `lib/auth/settings-auth.tsx` — Read from params instead of searchParams
- `components/layout/app-shell.tsx` — Simplify, remove OrgProvider

### Navigation (3 files)
- `components/navigation/navigation-shell.tsx` — Use orgId from path
- `components/navigation/child-sidebar.tsx` — Prefix all links with orgId
- `components/settings/settings-tabs.tsx` — Prefix links with orgId

### Route Pages (~21 files)
All pages under dashboard/, seo/, settings/ — move into `[orgId]/` directory, remove `searchParams.org` handling.

### Client Components (~8 files)
Components using `useBuildOrgHref()` — replace with direct path construction using orgId prop or context.

### New Files
- `middleware.ts` — Auth + org redirect
- `app/(authenticated)/[orgId]/layout.tsx` — Org validation layout
