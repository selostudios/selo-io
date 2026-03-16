# Org-in-URL Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move organization context from `?org=` query parameter to a `[orgId]` path segment so the org is always part of the URL and never falls out of sync.

**Architecture:** Add a `[orgId]` dynamic segment under `app/(authenticated)/` for all org-scoped routes. Create middleware to redirect bare routes to the user's last-used org. Rewrite the org selector to swap the path segment. Delete all `?org=` param handling.

**Tech Stack:** Next.js App Router dynamic segments, Next.js middleware, `selo-org` cookie.

---

## Task 1: Create middleware for org redirect

**Files:**
- Create: `middleware.ts`

The middleware intercepts requests to org-scoped routes that are missing the `[orgId]` segment. It reads the `selo-org` cookie and redirects to `/{orgId}/path`. If no cookie, redirects to `/organizations`.

**Step 1: Create `middleware.ts`**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that require an org segment in the URL
const ORG_SCOPED_PREFIXES = ['/dashboard', '/seo', '/settings', '/support']

// Routes that never have an org segment
const NON_ORG_PREFIXES = [
  '/quick-audit',
  '/app-settings',
  '/organizations',
  '/login',
  '/onboarding',
  '/auth',
  '/accept-invite',
  '/api',
  '/s/',
  '/r/',
  '/_next',
  '/favicon',
]

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(segment: string): boolean {
  return UUID_REGEX.test(segment)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip non-org routes, static files, API routes
  if (NON_ORG_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Skip static files
  if (pathname.includes('.')) {
    return NextResponse.next()
  }

  // Check if the first segment is already a UUID (org-scoped route)
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0 && isUUID(segments[0])) {
    // Already has org in path — refresh Supabase auth cookies and continue
    return await updateSupabaseSession(request)
  }

  // If this is an org-scoped route without an org segment, redirect
  if (ORG_SCOPED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const orgId = request.cookies.get('selo-org')?.value

    if (orgId && isUUID(orgId)) {
      // Redirect to /{orgId}/current/path
      const url = request.nextUrl.clone()
      url.pathname = `/${orgId}${pathname}`
      return NextResponse.redirect(url)
    }

    // No org cookie — send to organizations page to pick one
    const url = request.nextUrl.clone()
    url.pathname = '/organizations'
    return NextResponse.redirect(url)
  }

  // All other routes: refresh Supabase auth session
  return await updateSupabaseSession(request)
}

async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (middleware doesn't break existing routes yet)

**Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware for org URL redirect"
```

---

## Task 2: Create `[orgId]` layout with validation

**Files:**
- Create: `app/(authenticated)/[orgId]/layout.tsx`

This layout validates the org UUID, checks user access, and updates the `selo-org` cookie. All org-scoped pages will be nested under this.

**Step 1: Create the layout**

```typescript
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { SELO_ORG_COOKIE } from '@/lib/constants/org-storage'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}

export default async function OrgScopedLayout({ children, params }: LayoutProps) {
  const { orgId } = await params

  // Validate UUID format
  if (!UUID_REGEX.test(orgId)) {
    notFound()
  }

  // Auth check
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) redirect('/onboarding')

  const isInternal = isInternalUser(userRecord)

  // Access check: external users can only access their own org
  if (!isInternal && userRecord.organization_id !== orgId) {
    redirect(`/${userRecord.organization_id}/dashboard`)
  }

  // Update the selo-org cookie to keep it in sync with the URL
  const cookieStore = await cookies()
  const currentCookieOrg = cookieStore.get(SELO_ORG_COOKIE)?.value
  if (currentCookieOrg !== orgId) {
    cookieStore.set(SELO_ORG_COOKIE, orgId, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    })
  }

  return <>{children}</>
}
```

**Step 2: Run build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/layout.tsx
git commit -m "feat: add [orgId] layout with validation and cookie sync"
```

---

## Task 3: Move route directories into `[orgId]/`

This is a file-move task. Move all org-scoped route directories from `app/(authenticated)/` into `app/(authenticated)/[orgId]/`.

**Step 1: Move directories**

```bash
# Move org-scoped routes into [orgId]/
mv app/\(authenticated\)/dashboard app/\(authenticated\)/\[orgId\]/dashboard
mv app/\(authenticated\)/seo app/\(authenticated\)/\[orgId\]/seo
mv app/\(authenticated\)/settings app/\(authenticated\)/\[orgId\]/settings
mv app/\(authenticated\)/support app/\(authenticated\)/\[orgId\]/support
```

Verify these remain at top level (NOT moved):
- `app/(authenticated)/quick-audit/`
- `app/(authenticated)/app-settings/`
- `app/(authenticated)/organizations/`

**Step 2: Run build to verify route resolution**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds. Routes now show as `/{orgId}/dashboard`, `/{orgId}/seo/audit`, etc.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move org-scoped routes under [orgId] segment"
```

---

## Task 4: Update pages to read `orgId` from params instead of searchParams

Every page that currently reads `searchParams.org` must switch to `params.orgId`. The `[orgId]/layout.tsx` already validates access, so pages just need the org ID for data fetching.

**Files to modify:**

### 4a: Dashboard page (`app/(authenticated)/[orgId]/dashboard/page.tsx`)

Change from:
```typescript
interface PageProps {
  searchParams: Promise<{ org?: string }>
}
export default async function DashboardPage({ searchParams }: PageProps) {
  const { org: selectedOrgId } = await searchParams
  // ... resolveOrganizationId(selectedOrgId, ...)
```

Change to:
```typescript
interface PageProps {
  params: Promise<{ orgId: string }>
}
export default async function DashboardPage({ params }: PageProps) {
  const { orgId: organizationId } = await params
  // Remove: resolveOrganizationId call — orgId already validated by layout
  // Use organizationId directly for queries
```

Remove the `resolveOrganizationId` import and call. Remove the `isInternal`/`selectedOrgId` logic. The layout already validated access.

### 4b: Campaigns page (`app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx`)

Same pattern: replace `searchParams.org` with `params.orgId`. Remove `resolveOrganizationId`.

### 4c: Campaign detail page (`app/(authenticated)/[orgId]/dashboard/campaigns/[id]/page.tsx`)

Params are now `{ orgId: string; id: string }`.

### 4d: Audit list page (`app/(authenticated)/[orgId]/seo/audit/page.tsx`)

Change from:
```typescript
interface PageProps {
  searchParams: Promise<{ org?: string }>
}
export default async function UnifiedAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getUnifiedAuditData(organizationId)
```

Change to:
```typescript
interface PageProps {
  params: Promise<{ orgId: string }>
}
export default async function UnifiedAuditPage({ params }: PageProps) {
  const { orgId } = await params
  const data = await getUnifiedAuditData(orgId)
```

### 4e: Audit detail page (`app/(authenticated)/[orgId]/seo/audit/[id]/page.tsx`)

Params become `{ orgId: string; id: string }`. The page doesn't currently use org, so minimal change — just update the interface.

### 4f: Client reports page (`app/(authenticated)/[orgId]/seo/client-reports/page.tsx`)

Same pattern: `params.orgId` instead of `searchParams.org`.

### 4g: Client reports detail page (`app/(authenticated)/[orgId]/seo/client-reports/[id]/page.tsx`)

Params become `{ orgId: string; id: string }`.

### 4h: Legacy audit pages (site-audit, page-speed, aio)

Same pattern for each: `params.orgId` instead of `searchParams.org`.

### 4i: Settings pages (organization, team, integrations)

These use `withSettingsAuth(searchParams, ...)`. Update `withSettingsAuth` to accept `orgId: string` directly instead of reading from searchParams:

**Modify `lib/auth/settings-auth.tsx`:**

Change signature from:
```typescript
export async function withSettingsAuth<T>(
  searchParams: Promise<{ org?: string }>,
  getData: ...,
): Promise<SettingsAuthResult<T>>
```

To:
```typescript
export async function withSettingsAuth<T>(
  orgId: string,
  getData: ...,
): Promise<SettingsAuthResult<T>>
```

Remove `resolveOrganizationId` call — use `orgId` directly. Then update each settings page to pass `params.orgId` instead of `searchParams`.

### 4j: Settings monitoring page

If it exists and uses org, update the same way.

### 4k: Support page (`app/(authenticated)/[orgId]/support/page.tsx`)

If it uses org context, update similarly. If not, it just gets the params but doesn't need to read them.

**Step: After all page updates, run:**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

**Commit:**

```bash
git add -A
git commit -m "refactor: update all pages to read orgId from route params"
```

---

## Task 5: Rewrite org-context hooks

**Files:**
- Modify: `hooks/use-org-context.tsx`

The `OrgProvider`, `useOrgId`, `useSetOrgId`, and `useBuildOrgHref` hooks need to work with the path-based org instead of `?org=` query param.

**New approach:**
- `useOrgId()` reads the orgId from the URL pathname (first segment after `/`)
- `useBuildOrgHref(path)` prepends `/{orgId}` to a path
- `OrgProvider` and `useSetOrgId` are no longer needed (org is in URL, not state)

**Rewrite `hooks/use-org-context.tsx`:**

```typescript
'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Extract the org ID from the current URL pathname.
 * Returns the first path segment if it's a UUID, null otherwise.
 */
export function useOrgId(): string | null {
  const pathname = usePathname()
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return firstSegment && UUID_REGEX.test(firstSegment) ? firstSegment : null
}

/**
 * Returns a function that prepends /{orgId} to a path.
 * If no org in URL, returns the path unchanged.
 *
 * Usage: buildOrgHref('/seo/audit') → '/{orgId}/seo/audit'
 */
export function useBuildOrgHref(): (path: string) => string {
  const orgId = useOrgId()

  return useCallback(
    (path: string) => {
      if (!orgId) return path
      // Avoid double-prefixing if path already starts with org
      if (path.startsWith(`/${orgId}`)) return path
      return `/${orgId}${path.startsWith('/') ? '' : '/'}${path}`
    },
    [orgId]
  )
}
```

Delete: `OrgProvider`, `useSetOrgId`, `getOrgFromBrowser`, `subscribeToOrgChanges`, `getServerSnapshot`, `OrgContext`.

**Step: Run tests**

```bash
npx vitest tests/unit/hooks/use-org-context.test.tsx --run
```

Tests will fail — update them to match new behavior (test that `useOrgId` extracts from pathname, `useBuildOrgHref` prepends org).

**Commit:**

```bash
git add hooks/use-org-context.tsx tests/unit/hooks/use-org-context.test.tsx
git commit -m "refactor: rewrite org hooks to use path-based org ID"
```

---

## Task 6: Update AppShell and authenticated layout

**Files:**
- Modify: `components/layout/app-shell.tsx`
- Modify: `app/(authenticated)/layout.tsx`
- Modify: `lib/auth/resolve-layout-data.ts`

### 6a: Remove OrgProvider from AppShell

Remove `OrgProvider` import and wrapper from `app-shell.tsx`. Remove `resolvedOrgId` prop since the org is now in the URL.

Update `OrgSelector` props — it no longer needs `selectedOrganizationId` passed from server. It reads org from the URL via `useOrgId()`.

### 6b: Simplify resolve-layout-data.ts

Remove the `resolveOrganizationId` call and `resolvedOrgId` from `LayoutData`. The org is in the URL now.

### 6c: Update authenticated layout

The layout no longer needs to resolve org for the shell. Just pass user data to AppShell.

**Commit:**

```bash
git add components/layout/app-shell.tsx app/\(authenticated\)/layout.tsx lib/auth/resolve-layout-data.ts
git commit -m "refactor: remove OrgProvider and resolvedOrgId from app shell"
```

---

## Task 7: Rewrite OrgSelector for path-based navigation

**Files:**
- Modify: `components/shared/org-selector.tsx`

The selector now swaps the org UUID segment in the URL path instead of setting a `?org=` query param.

**Key changes:**
- `useOrgId()` to read current org from path
- On org switch: replace the first UUID segment with the new orgId
- If on a detail page (path has a second UUID like `/audit/{auditId}`), navigate to parent list
- Still update `selo-org` cookie for middleware fallback
- Remove all `searchParams`, `LAST_ORG_KEY` localStorage, and `useSetOrgId` usage

**Navigation logic:**

```typescript
const navigateToOrg = useCallback(
  (newOrgId: string) => {
    // Update cookie for middleware redirect fallback
    document.cookie = `selo-org=${newOrgId}; path=/; max-age=31536000; SameSite=Lax`

    const currentOrgId = useOrgId() // from hook at component level
    // Replace org segment in current path
    let targetPath = pathname
    if (currentOrgId) {
      targetPath = pathname.replace(`/${currentOrgId}`, `/${newOrgId}`)
    } else {
      targetPath = `/${newOrgId}${pathname}`
    }

    // If on a detail page (second UUID in path), go to parent
    const segments = targetPath.split('/').filter(Boolean)
    // segments[0] is orgId, check if last segment is also UUID
    if (segments.length > 2) {
      const lastSegment = segments[segments.length - 1]
      if (UUID_REGEX.test(lastSegment)) {
        segments.pop()
        targetPath = '/' + segments.join('/')
      }
    }

    startTransition(() => {
      router.push(targetPath)
      router.refresh()
    })
  },
  [pathname, router]
)
```

Remove: `useSearchParams`, `urlOrgId`, localStorage reads/writes, `useSetOrgId`, `navigateToOrg` cookie sync effects.

**Commit:**

```bash
git add components/shared/org-selector.tsx
git commit -m "refactor: rewrite org selector for path-based navigation"
```

---

## Task 8: Update navigation components

**Files:**
- Modify: `components/navigation/navigation-shell.tsx`
- Modify: `components/navigation/child-sidebar.tsx`
- Modify: `components/settings/settings-tabs.tsx`

### 8a: Navigation shell

Remove `searchParams.get('org')` usage. Read org from path via `useOrgId()`. The `handleSectionChange` builds hrefs with `/${orgId}/dashboard` etc. instead of appending `?org=`.

```typescript
const orgId = useOrgId()
// ...
const handleSectionChange = useCallback(
  (section: ParentSection) => {
    if (section !== activeSection) {
      const baseRoute = sectionDefaultRoutes[section]
      // Prefix org-scoped routes with orgId
      const needsOrg = ['/dashboard', '/seo', '/settings', '/support'].some(p => baseRoute.startsWith(p))
      const href = needsOrg && orgId ? `/${orgId}${baseRoute}` : baseRoute
      router.push(href)
    }
  },
  [activeSection, router, orgId]
)
```

Also update `getSectionFromPathname` to handle the orgId prefix:
```typescript
function getSectionFromPathname(pathname: string): ParentSection {
  // Strip the leading UUID segment if present
  const stripped = pathname.replace(/^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, '')
  if (stripped.startsWith('/quick-audit')) return 'quick-audit'
  if (stripped.startsWith('/organizations')) return 'organizations'
  if (stripped.startsWith('/app-settings')) return 'app-settings'
  if (stripped.startsWith('/support')) return 'support'
  return 'home'
}
```

### 8b: Child sidebar

Remove `searchParams.get('org')` and the conditional `?org=` appending logic. All `home` section links get prefixed with `/${orgId}`:

```typescript
const orgId = useOrgId()
// ...
// In the link building:
let href = item.href
if (orgId && activeSection === 'home') {
  href = `/${orgId}${item.href}`
}
```

Also update `isActive` checks to compare against the path without the org prefix.

### 8c: Settings tabs

Remove `searchParams.get('org')` and `?org=` appending. Use `useOrgId()` to prefix hrefs:

```typescript
const orgId = useOrgId()
// ...
const href = orgId ? `/${orgId}${tab.href}` : tab.href
```

Also update `isActive` to compare pathname without org prefix.

**Commit:**

```bash
git add components/navigation/navigation-shell.tsx components/navigation/child-sidebar.tsx components/settings/settings-tabs.tsx
git commit -m "refactor: update navigation to use path-based org"
```

---

## Task 9: Update client components that use `useBuildOrgHref`

All ~14 client components that call `useBuildOrgHref()` continue to work unchanged — the hook signature is the same, it just prepends `/{orgId}` instead of appending `?org=`. No code changes needed in these files.

**Verify by running build:**

```bash
npm run build 2>&1 | tail -20
```

The following files should work without modification (they all use `buildOrgHref('/some/path')` which now returns `/{orgId}/some/path`):
- `app/(authenticated)/[orgId]/seo/audit/client.tsx`
- `app/(authenticated)/[orgId]/seo/client-reports/client.tsx`
- `app/(authenticated)/[orgId]/seo/aio/client.tsx`
- `app/(authenticated)/[orgId]/seo/page-speed/client.tsx`
- `app/(authenticated)/[orgId]/seo/site-audit/client.tsx`
- `components/reports/report-presentation.tsx`
- `components/audit/audit-dashboard.tsx`
- `components/audit/audit-history-list.tsx`
- `components/audit/website-url-toast.tsx`
- `components/aio/aio-audit-history-list.tsx`
- `components/campaigns/create-campaign-form.tsx`
- `components/campaigns/create-campaign-dialog.tsx`
- `components/performance/performance-dashboard.tsx`
- `app/support/page-client.tsx`

If any fail, it's because they have hardcoded `/seo/...` links (not using `buildOrgHref`). Fix those to use the hook.

---

## Task 10: Update organizations page links

**Files:**
- Modify: `app/(authenticated)/organizations/client.tsx`

The organizations table links currently use `?org=`:
```typescript
href={`/settings/organization?org=${org.id}`}
```

Change to:
```typescript
href={`/${org.id}/settings/organization`}
```

**Commit:**

```bash
git add app/\(authenticated\)/organizations/client.tsx
git commit -m "refactor: update org list links to path-based org URLs"
```

---

## Task 11: Delete dead code

**Files to delete:**
- `lib/auth/resolve-org.ts` — No longer needed (org comes from URL path)

**Files to clean up:**
- `lib/constants/org-storage.ts` — Remove `LAST_ORG_KEY` export (keep `SELO_ORG_COOKIE`)
- Remove `LAST_ORG_KEY` imports from `components/shared/org-selector.tsx` (already done in Task 7)
- Remove all `import { resolveOrganizationId }` across the codebase

**Search for remaining references:**

```bash
rg "resolveOrganizationId" --type ts
rg "LAST_ORG_KEY" --type ts
rg "searchParams.*org" --type ts --type tsx
rg "'use server'" lib/auth/resolve-org.ts  # should be deleted
```

Clean up any remaining references.

**Commit:**

```bash
git add -A
git commit -m "chore: delete resolve-org.ts and clean up dead org param code"
```

---

## Task 12: Update E2E tests

**Files:**
- Modify: `tests/e2e/unified-audit.spec.ts`

E2E tests navigate to `/seo/audit` etc. These will now need the org prefix, or rely on middleware redirect. Since the middleware redirects bare `/seo/audit` to `/{orgId}/seo/audit`, the tests may work as-is after login (cookie gets set during login).

**Verify:**

```bash
npm run test:e2e 2>&1 | tail -30
```

If tests fail because middleware redirects aren't followed, update test URLs to include the org ID, or ensure the seed data sets the `selo-org` cookie.

---

## Task 13: Update `useActiveAudit` hook

**Files:**
- Check: `hooks/use-active-audit.ts`

The `useActiveAudit` hook is called from `navigation-shell.tsx` and currently receives `orgParam` from `searchParams.get('org')`. Update it to accept the org from `useOrgId()` or receive it as a prop.

---

## Task 14: Final verification

**Step 1: Run lint**
```bash
npm run lint
```

**Step 2: Run format**
```bash
npm run format:check
```

**Step 3: Run unit tests**
```bash
npm run test:unit
```

**Step 4: Run build**
```bash
npm run build
```

**Step 5: Manual smoke test**
- Start dev server: `npm run dev`
- Login → should redirect to `/{orgId}/dashboard`
- Navigate sidebar → all links have org in path
- Switch org → path updates, data refreshes
- Direct URL `/dashboard` → redirects to `/{orgId}/dashboard`
- Direct URL `/{orgId}/seo/audit` → works
- `/quick-audit` → no org in URL
- `/organizations` → links go to `/{orgId}/settings/organization`

---

## Files Summary

| File | Action | Task |
|------|--------|------|
| `middleware.ts` | Create | 1 |
| `app/(authenticated)/[orgId]/layout.tsx` | Create | 2 |
| `app/(authenticated)/[orgId]/dashboard/` | Move | 3 |
| `app/(authenticated)/[orgId]/seo/` | Move | 3 |
| `app/(authenticated)/[orgId]/settings/` | Move | 3 |
| `app/(authenticated)/[orgId]/support/` | Move | 3 |
| `app/(authenticated)/[orgId]/dashboard/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/dashboard/campaigns/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/dashboard/campaigns/[id]/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/audit/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/audit/[id]/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/client-reports/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/client-reports/[id]/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/site-audit/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/page-speed/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/seo/aio/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/settings/organization/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/settings/team/page.tsx` | Modify | 4 |
| `app/(authenticated)/[orgId]/settings/integrations/page.tsx` | Modify | 4 |
| `lib/auth/settings-auth.tsx` | Modify | 4 |
| `hooks/use-org-context.tsx` | Rewrite | 5 |
| `tests/unit/hooks/use-org-context.test.tsx` | Rewrite | 5 |
| `components/layout/app-shell.tsx` | Modify | 6 |
| `app/(authenticated)/layout.tsx` | Modify | 6 |
| `lib/auth/resolve-layout-data.ts` | Modify | 6 |
| `components/shared/org-selector.tsx` | Rewrite | 7 |
| `components/navigation/navigation-shell.tsx` | Modify | 8 |
| `components/navigation/child-sidebar.tsx` | Modify | 8 |
| `components/settings/settings-tabs.tsx` | Modify | 8 |
| `app/(authenticated)/organizations/client.tsx` | Modify | 10 |
| `lib/auth/resolve-org.ts` | Delete | 11 |
| `lib/constants/org-storage.ts` | Modify | 11 |
| `tests/e2e/unified-audit.spec.ts` | Possibly modify | 12 |
| `hooks/use-active-audit.ts` | Modify | 13 |
