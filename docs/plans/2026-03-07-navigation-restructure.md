# Navigation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Audits and Reports from the SEO parent section into the Home child sidebar. Add a Quick Audit parent section for internal-only one-time URL audits. Remove the SEO parent section.

**Architecture:** The navigation is driven by config objects in 3 files: `parent-sidebar.tsx` (parent icons), `child-sidebar.tsx` (child menu config), and `navigation-shell.tsx` (section routing). The actual `/seo/*` routes stay unchanged — we're only changing which parent section owns them in the nav. A new `/quick-audit` route provides a unified page for internal users to run one-time audits on arbitrary URLs.

**Tech Stack:** Next.js App Router, React client components, Lucide icons, Tailwind CSS

---

### Task 1: Update Parent Sidebar — replace SEO with Quick Audit

**Files:**

- Modify: `components/navigation/parent-sidebar.tsx`

**Step 1: Update the ParentSection type and sections array**

Replace the `seo` section with `quick-audit` (internal only), and update the Support section to also be visible for users with `canViewFeedback`:

```tsx
// parent-sidebar.tsx

import { House, Zap, Building2, LifeBuoy } from 'lucide-react'

export type ParentSection = 'home' | 'quick-audit' | 'organizations' | 'support'

const sections: SectionItem[] = [
  { id: 'home', name: 'Home', icon: House },
  { id: 'quick-audit', name: 'Quick Audit', icon: Zap, internalOnly: true },
  { id: 'organizations', name: 'Organizations', icon: Building2, internalOnly: true },
  { id: 'support', name: 'Support', icon: LifeBuoy, internalOnly: true },
]
```

The existing visibility filter already handles `internalOnly` and the support `canViewFeedback` check — no changes needed there.

**Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

---

### Task 2: Update Child Sidebar — merge SEO nav into Home

**Files:**

- Modify: `components/navigation/child-sidebar.tsx`

**Step 1: Restructure the navigation config**

Merge `seoNavigation` groups into `homeNavigation` and add Settings as its own group at the bottom. Remove the standalone `seoNavigation`. Add a `quickAuditNavigation` for the new section:

```tsx
const homeNavigation: NavigationGroup[] = [
  {
    header: 'Dashboard',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
    ],
  },
  {
    header: 'Audits',
    items: [
      { name: 'Search Engine Optimization', href: '/seo/site-audit', icon: FileSearch },
      { name: 'Page Speed & Performance', href: '/seo/page-speed', icon: Gauge },
      { name: 'AI Optimization', href: '/seo/aio', icon: Sparkles },
    ],
  },
  {
    header: 'Reports',
    items: [{ name: 'Full Site Report', href: '/seo/reports', icon: FileText }],
  },
  {
    header: 'Settings',
    items: [{ name: 'Settings', href: '/settings/organization', icon: Settings }],
  },
]

const quickAuditNavigation: NavigationGroup[] = [
  {
    items: [{ name: 'Run Audit', href: '/quick-audit', icon: Zap }],
  },
]
```

Update the `navigationConfig` to replace `seo` with `quick-audit`:

```tsx
const navigationConfig: Record<ParentSection, NavigationGroup[]> = {
  home: homeNavigation,
  'quick-audit': quickAuditNavigation,
  organizations: organizationsNavigation,
  support: supportNavigation,
}
```

**Step 2: Update role-based filtering**

The current filter only applies to `activeSection === 'home'`. Since audit/report items are now in Home, the filter logic stays the same — it already only hides Dashboard and Campaigns based on role. Audit/Report/Settings items have no role filter (visible to all), which is correct.

**Step 3: Update org param preservation**

The current code preserves `?org=` only for `activeSection === 'seo'`. Since SEO routes are now under `home`, update the org param preservation condition:

```tsx
// Old:
if (
  orgParam &&
  (activeSection === 'seo' ||
    item.href.startsWith('/settings') ||
    item.href.startsWith('/dashboard'))
) {

// New:
if (
  orgParam &&
  (item.href.startsWith('/seo') ||
    item.href.startsWith('/settings') ||
    item.href.startsWith('/dashboard'))
) {
```

This is simpler — just check the href prefix instead of the active section.

**Step 4: Import `Zap` icon**

Add `Zap` to the lucide-react import at the top of the file.

**Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

---

### Task 3: Update Navigation Shell — route mapping

**Files:**

- Modify: `components/navigation/navigation-shell.tsx`

**Step 1: Update `getSectionFromPathname`**

`/seo/*` routes should now map to `'home'` instead of `'seo'`. Add `/quick-audit` mapping:

```tsx
function getSectionFromPathname(pathname: string): ParentSection {
  if (pathname.startsWith('/quick-audit')) {
    return 'quick-audit'
  }
  if (pathname.startsWith('/organizations')) {
    return 'organizations'
  }
  if (pathname.startsWith('/support')) {
    return 'support'
  }
  // Default to home for /dashboard, /seo, /settings, /profile, etc.
  return 'home'
}
```

**Step 2: Update `sectionDefaultRoutes`**

Replace `seo` with `quick-audit`:

```tsx
const sectionDefaultRoutes: Record<ParentSection, string> = {
  home: '/dashboard',
  'quick-audit': '/quick-audit',
  organizations: '/organizations',
  support: '/support',
}
```

**Step 3: Update org param preservation in `handleSectionChange`**

The current code preserves org for `section === 'home' || section === 'seo'`. Since there's no `seo` section anymore, simplify:

```tsx
const href = orgParam && section === 'home' ? `${baseRoute}?org=${orgParam}` : baseRoute
```

**Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

---

### Task 4: Create Quick Audit page

**Files:**

- Create: `app/(authenticated)/quick-audit/page.tsx`

**Step 1: Create the Quick Audit page**

This is a single page where internal users can enter a URL and pick an audit type. It reuses existing API routes — no new backend needed.

```tsx
import { getCurrentUser } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import { QuickAuditClient } from './client'

export default async function QuickAuditPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')
  if (!currentUser.isInternal) redirect('/dashboard')

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick Audit</h1>
        <p className="text-sm text-neutral-500">
          Run a one-time audit on any URL without linking to an organization.
        </p>
      </div>
      <QuickAuditClient />
    </div>
  )
}
```

**Step 2: Create the Quick Audit client component**

```tsx
// app/(authenticated)/quick-audit/client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSearch, Gauge, Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuditType = 'site-audit' | 'page-speed' | 'aio'

const auditTypes = [
  {
    id: 'site-audit' as AuditType,
    name: 'SEO Audit',
    description: 'Comprehensive site crawl checking SEO, AI-readiness, and technical issues',
    icon: FileSearch,
  },
  {
    id: 'page-speed' as AuditType,
    name: 'Page Speed',
    description: 'Core Web Vitals and performance analysis via PageSpeed Insights',
    icon: Gauge,
  },
  {
    id: 'aio' as AuditType,
    name: 'AI Optimization',
    description: 'Check how well your site is optimized for AI search engines',
    icon: Sparkles,
  },
]

export function QuickAuditClient() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState<AuditType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunAudit = async (type: AuditType) => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    try {
      new URL(normalizedUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(type)
    setError(null)

    try {
      let endpoint: string
      let body: Record<string, unknown>
      let redirectPath: string

      switch (type) {
        case 'site-audit':
          endpoint = '/api/audit/start'
          body = { url: normalizedUrl }
          redirectPath = '/seo/site-audit'
          break
        case 'page-speed':
          endpoint = '/api/performance/start'
          body = { urls: [normalizedUrl] }
          redirectPath = '/seo/page-speed'
          break
        case 'aio':
          endpoint = '/api/aio/audit/start'
          body = { url: normalizedUrl, organizationId: null, sampleSize: 5 }
          redirectPath = '/seo/aio'
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start audit')
      }

      const data = await response.json()
      const auditId = data.auditId

      // Navigate to the audit detail page
      router.push(`${redirectPath}/${auditId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Website URL</CardTitle>
          <CardDescription>Enter the URL you want to audit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="url" className="sr-only">
                URL
              </Label>
              <Input
                id="url"
                placeholder="example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                  }
                }}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Audit Type Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {auditTypes.map((audit) => {
          const Icon = audit.icon
          const isLoading = loading === audit.id
          const isDisabled = loading !== null

          return (
            <Card key={audit.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-neutral-500" />
                  <CardTitle className="text-base">{audit.name}</CardTitle>
                </div>
                <CardDescription className="text-sm">{audit.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleRunAudit(audit.id)}
                  disabled={isDisabled || !url.trim()}
                  className="w-full"
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Run Audit
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

---

### Task 5: Verify build and tests

**Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds, `/quick-audit` route appears in output

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: restructure navigation — move audits/reports into Home, add Quick Audit"
```

---

## Summary of Changes

| File                                         | Change                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `components/navigation/parent-sidebar.tsx`   | Replace `seo` section with `quick-audit` (internal only)                |
| `components/navigation/child-sidebar.tsx`    | Merge SEO nav groups into Home, add Settings group, add quick-audit nav |
| `components/navigation/navigation-shell.tsx` | Map `/seo/*` to `home`, add `/quick-audit` mapping                      |
| `app/(authenticated)/quick-audit/page.tsx`   | New page — server component with internal-only guard                    |
| `app/(authenticated)/quick-audit/client.tsx` | New page — URL input + 3 audit type cards                               |

**No route changes:** All existing `/seo/*` URLs continue to work. The SEO layout (`app/(authenticated)/seo/layout.tsx`) is unchanged.

**No API changes:** Quick Audit reuses existing `/api/audit/start`, `/api/performance/start`, and `/api/aio/audit/start` endpoints.

**No permission changes:** Quick Audit page has server-side `isInternal` guard matching existing API-level restrictions.
