# Unified Organization Selector Plan

## Problem

We currently have two separate organization selectors:
1. **OrganizationSelector** - Used in Dashboard, Settings, Profile, Organizations pages
2. **AuditTargetSelector** - Used in SEO pages (Site Audit, PageSpeed, AIO)

This causes:
- Inconsistent UX between sections
- Flash when navigating from SEO pages to Dashboard (org selector resets)
- Code duplication
- Confusion about which selector to use

## Solution

Merge into a single **UnifiedOrgSelector** component that:
- Always shows organization selection
- Conditionally shows "One-time URL" option only on SEO/AIO routes
- Eliminates flash by reading from URL params consistently
- Uses same localStorage key across all pages

## Implementation

### 1. Create Unified Component

**File:** `components/shared/unified-org-selector.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Plus, Building2, Check, Link2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { CreateOrganizationDialog } from '@/components/dashboard/create-organization-dialog'
import type { OrganizationForSelector } from '@/lib/organizations/types'

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_VIEW_KEY = 'selo-last-view-type'
const CHILD_SIDEBAR_COLLAPSED_KEY = 'child-sidebar-collapsed'

interface UnifiedOrgSelectorProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId?: string | null
}

// SEO routes where "One-time URL" option should appear
const SEO_ROUTES = ['/seo/site-audit', '/seo/page-speed', '/seo/aio']

export function UnifiedOrgSelector({
  organizations,
  isInternal,
  selectedOrganizationId: initialSelectedOrgId,
}: UnifiedOrgSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Determine if we're on an SEO route
  const isSeoRoute = SEO_ROUTES.some((route) => pathname.startsWith(route))

  // Read org from URL searchParams, falling back to prop
  const urlOrgId = searchParams.get('org')
  const selectedOrganizationId = urlOrgId || initialSelectedOrgId

  // Check if one-time mode is active (only relevant on SEO routes)
  const isOneTimeMode = isSeoRoute && !selectedOrganizationId

  const selectedOrg = organizations.find((o) => o.id === selectedOrganizationId)
  const activeOrganizations = organizations.filter((o) => o.status !== 'inactive')

  const handleSelectOrganization = (orgId: string) => {
    localStorage.setItem(LAST_ORG_KEY, orgId)
    localStorage.setItem(LAST_VIEW_KEY, 'organization')
    localStorage.setItem(CHILD_SIDEBAR_COLLAPSED_KEY, 'false')
    window.dispatchEvent(new Event('sidebar-expand'))

    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('org', orgId)
    router.push(pathname + url.search)
  }

  const handleSelectOneTime = () => {
    localStorage.removeItem(LAST_ORG_KEY)
    localStorage.setItem(LAST_VIEW_KEY, 'one-time')

    // Remove org param from URL
    router.push(pathname)
  }

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    handleSelectOrganization(organization.id)
  }

  // Initialize from localStorage on mount (only if no org selected)
  useEffect(() => {
    if (!selectedOrganizationId && activeOrganizations.length > 0 && !isSeoRoute) {
      const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
      if (lastOrgId && activeOrganizations.some((o) => o.id === lastOrgId)) {
        handleSelectOrganization(lastOrgId)
      } else {
        handleSelectOrganization(activeOrganizations[0].id)
      }
    }

    // For SEO routes, check if we should restore one-time mode
    if (isSeoRoute && !selectedOrganizationId) {
      const lastViewType = localStorage.getItem(LAST_VIEW_KEY)
      if (lastViewType === 'one-time') {
        // Already in one-time mode, do nothing
        return
      }
      // Check if we have a last org to restore
      const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
      if (lastOrgId && activeOrganizations.some((o) => o.id === lastOrgId)) {
        const org = activeOrganizations.find((o) => o.id === lastOrgId)
        if (org?.website_url) {
          handleSelectOrganization(lastOrgId)
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getDomain = (url: string | null): string => {
    if (!url) return ''
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const getDisplayLabel = (): React.ReactNode => {
    if (isOneTimeMode) {
      return (
        <span className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="truncate">One-time Audits</span>
        </span>
      )
    }

    if (!selectedOrg) {
      return <span className="text-neutral-500">Select organization</span>
    }

    return (
      <>
        {selectedOrg.logo_url ? (
          <Image
            src={selectedOrg.logo_url}
            alt=""
            width={0}
            height={0}
            sizes="100px"
            className="h-7 w-auto max-w-24 rounded object-contain"
          />
        ) : (
          <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        )}
        <span className="truncate font-medium">{selectedOrg.name}</span>
        <Badge
          variant="secondary"
          className={cn(
            'text-xs',
            selectedOrg.status === 'prospect' && 'bg-amber-100 text-amber-700',
            selectedOrg.status === 'customer' && 'bg-green-100 text-green-700',
            selectedOrg.status === 'inactive' && 'bg-neutral-100 text-neutral-600'
          )}
        >
          {selectedOrg.status}
        </Badge>
      </>
    )
  }

  // External users see simple display (no dropdown)
  if (!isInternal) {
    const org = activeOrganizations[0]
    if (!org) {
      return (
        <div className="flex items-center gap-2 px-3 py-2">
          <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="text-neutral-500">No organization</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 px-3 py-2">
        {org.logo_url ? (
          <Image
            src={org.logo_url}
            alt=""
            width={0}
            height={0}
            sizes="100px"
            className="h-7 w-auto max-w-24 rounded object-contain"
          />
        ) : (
          <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        )}
        <span className="font-medium">{org.name}</span>
        {isSeoRoute && org.website_url && (
          <span className="text-muted-foreground text-sm">({getDomain(org.website_url)})</span>
        )}
      </div>
    )
  }

  // Internal users get dropdown
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto min-h-11 gap-2 bg-white px-3 py-2 hover:bg-neutral-100">
            {getDisplayLabel()}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          {/* One-time URL option (only on SEO routes) */}
          {isSeoRoute && (
            <>
              <DropdownMenuItem onClick={handleSelectOneTime}>
                <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Enter one-time URL…
                {isOneTimeMode && (
                  <Check className="ml-auto h-4 w-4 text-green-600" aria-hidden="true" />
                )}
              </DropdownMenuItem>
              {activeOrganizations.length > 0 && <DropdownMenuSeparator />}
            </>
          )}

          {/* Organizations list */}
          {activeOrganizations.map((org) => {
            const isDisabled = isSeoRoute && !org.website_url
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => !isDisabled && handleSelectOrganization(org.id)}
                className="flex items-center justify-between py-2"
                disabled={isDisabled}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{org.name}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        org.status === 'prospect' && 'bg-amber-100 text-amber-700',
                        org.status === 'customer' && 'bg-green-100 text-green-700',
                        org.status === 'inactive' && 'bg-neutral-100 text-neutral-600'
                      )}
                    >
                      {org.status}
                    </Badge>
                  </div>
                  {isSeoRoute && (
                    org.website_url ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {getDomain(org.website_url)}
                      </span>
                    ) : (
                      <span className="truncate text-xs text-neutral-400">No website URL</span>
                    )
                  )}
                </div>
                {org.id === selectedOrganizationId && (
                  <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            )
          })}

          {activeOrganizations.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleOrganizationCreated}
      />
    </>
  )
}
```

### 2. Update All Headers

#### Dashboard Header
**File:** `components/dashboard/header.tsx`

Replace:
```typescript
<OrganizationSelector
  organizations={organizations}
  selectedOrganizationId={selectedOrgId}
/>
```

With:
```typescript
<UnifiedOrgSelector
  organizations={organizations}
  isInternal={isInternal}
  selectedOrganizationId={selectedOrgId}
/>
```

#### SEO Header
**File:** `components/seo/seo-header.tsx`

Replace:
```typescript
<AuditTargetSelector
  organizations={organizations}
  selectedTarget={selectedTarget}
  onTargetChange={handleTargetChange}
  isInternal={isInternal}
/>
```

With:
```typescript
<UnifiedOrgSelector
  organizations={organizations}
  isInternal={isInternal}
  selectedOrganizationId={selectedOrgId}
/>
```

Remove the `selectedTarget` and `handleTargetChange` logic - now handled internally.

### 3. Update Client Components

All client components (page-speed/client.tsx, site-audit/client.tsx, aio/client.tsx) currently determine their target from the selector. Update them to read directly from URL searchParams:

```typescript
const searchParams = useSearchParams()
const selectedOrganizationId = searchParams.get('org')

const selectedTarget = useMemo(() => {
  if (selectedOrganizationId) {
    const org = organizations.find((o) => o.id === selectedOrganizationId)
    if (org?.website_url) {
      return {
        type: 'organization' as const,
        organizationId: org.id,
        url: org.website_url,
      }
    }
  }
  return { type: 'one-time' as const }
}, [selectedOrganizationId, organizations])
```

### 4. Delete Old Components

- Remove `components/dashboard/organization-selector.tsx`
- Remove `components/seo/audit-target-selector.tsx`

### 5. Benefits

✅ **Single source of truth** - One selector, one behavior
✅ **No more flash** - Consistent URL param handling across all pages
✅ **Contextual UI** - "One-time URL" only shows where relevant
✅ **Less code** - Eliminate duplication
✅ **Better UX** - Selector state persists when navigating between sections

### 6. Testing Checklist

- [ ] Navigate from Dashboard → SEO Site Audit (org should persist)
- [ ] Navigate from SEO Site Audit → Dashboard (org should persist)
- [ ] Select "One-time URL" on SEO page, then navigate to Dashboard (should auto-select an org)
- [ ] Select organization on Dashboard, navigate to SEO page (should stay on that org)
- [ ] Create new organization from selector (should work on all pages)
- [ ] External users see simple display (no dropdown) on all pages
- [ ] No flash when navigating between sections
- [ ] localStorage persists org selection across browser sessions

### 7. Migration Notes

**Breaking changes:** None - the API is compatible

**localStorage keys:**
- Keep using `selo-last-organization-id`
- Keep using `selo-last-view-type` for one-time mode
- Keep using `child-sidebar-collapsed`

**URL format:** Same - `?org={orgId}` or no param for one-time mode

### 8. Implementation Order

1. Create `UnifiedOrgSelector` component (test standalone first)
2. Replace `OrganizationSelector` in Dashboard header
3. Replace `AuditTargetSelector` in SEO header
4. Update SEO client components to read from URL directly
5. Delete old selector components
6. Test all navigation flows
7. Commit and push

---

## Decision Points

### Should we add the "Create Organization" option to the SEO selector?

**Answer:** Yes - keep it consistent. Internal users should be able to create orgs from anywhere.

### Should we auto-select an org when navigating from one-time mode to Dashboard?

**Answer:** Yes - use last selected org from localStorage, or fallback to first active org.

### Should external users see the selector at all on SEO pages?

**Answer:** Yes, but as a simple display showing their org name and website URL (not a dropdown).

---

## Success Criteria

- ✅ All navigation flows work without flashing
- ✅ Org selection persists across all pages
- ✅ "One-time URL" option only visible on SEO routes
- ✅ Build passes with no TypeScript errors
- ✅ Lint passes with no warnings
- ✅ All existing functionality preserved
