# AuditRunControl Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable `AuditRunControl` component for Page Speed and AIO audit views, removing monitored pages functionality.

**Architecture:** Single component with two modes (organization vs one-time), children slot for additional controls like SampleSizeSelector.

**Tech Stack:** React, TypeScript, Shadcn UI (Card, Input, Button)

---

### Task 1: Create AuditRunControl Component

**Files:**
- Create: `components/audit/audit-run-control.tsx`

**Step 1: Create the component file**

```tsx
'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Organization {
  id: string
  websiteUrl: string
}

interface AuditRunControlProps {
  /** Title shown for one-time audits (e.g., "One-Time Page Speed Audit") */
  title: string
  /** Description shown below title (e.g., "Add domain URL to begin auditing site") */
  description: string
  /** Organization data - if provided, shows org URL as title instead of input */
  organization?: Organization | null
  /** Callback when audit should start - receives URL and optional organizationId */
  onRunAudit: (url: string, organizationId?: string) => Promise<void>
  /** Whether audit is currently running */
  isRunning?: boolean
  /** Optional children rendered inside card content (e.g., SampleSizeSelector) */
  children?: ReactNode
}

export function AuditRunControl({
  title,
  description,
  organization,
  onRunAudit,
  isRunning = false,
  children,
}: AuditRunControlProps) {
  const [oneTimeUrl, setOneTimeUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRunAudit = async () => {
    setError(null)

    let url: string
    let organizationId: string | undefined

    if (organization) {
      url = organization.websiteUrl
      organizationId = organization.id
    } else {
      if (!oneTimeUrl.trim()) return

      url = oneTimeUrl.trim()
      // Add https:// if no protocol specified
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
    }

    try {
      await onRunAudit(url, organizationId)
    } catch (err) {
      console.error('[AuditRunControl] Failed to start audit:', err)
      setError('Failed to start audit')
    }
  }

  const isOneTime = !organization

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            {isOneTime ? (
              <>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="break-all">{organization.websiteUrl}</CardTitle>
                <CardDescription>Organization URL</CardDescription>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOneTime && (
              <Input
                type="url"
                placeholder="https://example.com"
                className="w-64"
                value={oneTimeUrl}
                onChange={(e) => setOneTimeUrl(e.target.value)}
                disabled={isRunning}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && oneTimeUrl.trim() && !isRunning) {
                    handleRunAudit()
                  }
                }}
                autoComplete="url"
              />
            )}
            <Button
              onClick={handleRunAudit}
              disabled={isRunning || (isOneTime && !oneTimeUrl.trim())}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Running…
                </>
              ) : (
                'Run Audit'
              )}
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" aria-live="polite" className="text-destructive mt-2 text-sm">
            {error}
          </p>
        )}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}
```

**Step 2: Run lint to verify**

Run: `npm run lint -- --max-warnings=0 components/audit/audit-run-control.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add components/audit/audit-run-control.tsx
git commit -m "feat: add reusable AuditRunControl component"
```

---

### Task 2: Update PageSpeedClient to Use AuditRunControl

**Files:**
- Modify: `app/(authenticated)/seo/page-speed/client.tsx`

**Step 1: Update imports and remove monitored pages logic**

Replace the one-time audit Card section with AuditRunControl:
- Import `AuditRunControl`
- Remove `monitoredPages` from props
- Update `selectedTarget` to include websiteUrl for organization
- Replace inline Card with `AuditRunControl` component

**Step 2: Update PerformanceDashboard usage**

The PerformanceDashboard is used when an organization is selected. It needs to be updated to use AuditRunControl and remove monitored pages.

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/(authenticated)/seo/page-speed/client.tsx
git commit -m "refactor: use AuditRunControl in PageSpeedClient"
```

---

### Task 3: Update PerformanceDashboard - Remove Monitored Pages

**Files:**
- Modify: `components/performance/performance-dashboard.tsx`

**Step 1: Remove monitored pages functionality**

- Remove `monitoredPages` from props interface
- Remove all state and handlers related to monitored pages (newUrl, handleAddPage, handleRemovePage)
- Remove the "Monitored Pages" Card section entirely
- Simplify `handleRunAudit` to only use websiteUrl (single URL)
- Use `AuditRunControl` component instead of inline Card

**Step 2: Run lint**

Run: `npm run lint -- --max-warnings=0 components/performance/performance-dashboard.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add components/performance/performance-dashboard.tsx
git commit -m "refactor: remove monitored pages, use AuditRunControl in PerformanceDashboard"
```

---

### Task 4: Update PageSpeed Actions to Remove Monitored Pages

**Files:**
- Modify: `app/(authenticated)/seo/page-speed/actions.ts`

**Step 1: Remove monitoredPages from getPageSpeedData**

- Remove the query for monitored pages
- Update return type to exclude monitoredPages

**Step 2: Run lint**

Run: `npm run lint -- --max-warnings=0 app/(authenticated)/seo/page-speed/actions.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add app/(authenticated)/seo/page-speed/actions.ts
git commit -m "refactor: remove monitored pages from page speed actions"
```

---

### Task 5: Update AIOAuditClient to Use AuditRunControl

**Files:**
- Modify: `app/(authenticated)/seo/aio/client.tsx`

**Step 1: Replace inline Card with AuditRunControl**

- Import `AuditRunControl`
- Replace the "Audit Configuration Card" with `AuditRunControl`
- Pass `SampleSizeSelector` as children
- Move the button logic into the `onRunAudit` callback

**Step 2: Run lint**

Run: `npm run lint -- --max-warnings=0 app/(authenticated)/seo/aio/client.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add app/(authenticated)/seo/aio/client.tsx
git commit -m "refactor: use AuditRunControl in AIOAuditClient"
```

---

### Task 6: Clean Up Unused Code

**Files:**
- Check: `lib/performance/types.ts` - Remove MonitoredPage if unused
- Check: `app/api/performance/pages/route.ts` - May need to remove or deprecate

**Step 1: Check for unused imports/types**

Search for `MonitoredPage` and `monitored_pages` usage across codebase.

**Step 2: Remove unused API route if no longer needed**

If `/api/performance/pages` is only used for monitored pages, consider removing or marking as deprecated.

**Step 3: Run full test suite**

Run: `npm run lint && npm run test:unit && npm run build`
Expected: All pass

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up unused monitored pages code"
```

---

### Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npm run lint && npm run test:unit && npm run build`
Expected: All pass

**Step 2: Manual verification**

- Test Page Speed view with organization selected
- Test Page Speed view with one-time URL
- Test AIO view with organization selected
- Test AIO view with one-time URL
- Verify SampleSizeSelector appears correctly in AIO

---

## Component API Summary

```tsx
interface AuditRunControlProps {
  title: string                    // "One-Time Page Speed Audit"
  description: string              // "Add domain URL to begin auditing site"
  organization?: {                 // If provided, shows org URL mode
    id: string
    websiteUrl: string
  } | null
  onRunAudit: (url: string, organizationId?: string) => Promise<void>
  isRunning?: boolean
  children?: ReactNode             // For SampleSizeSelector, etc.
}
```

**Usage in Page Speed:**
```tsx
<AuditRunControl
  title="One-Time Page Speed Audit"
  description="Add domain URL to begin auditing site"
  organization={selectedTarget?.type === 'organization' ? {
    id: selectedTarget.organizationId,
    websiteUrl: selectedTarget.url
  } : null}
  onRunAudit={handleRunAudit}
  isRunning={isPending}
/>
```

**Usage in AIO:**
```tsx
<AuditRunControl
  title="One-Time AIO Audit"
  description="Add URL to begin AIO audit"
  organization={selectedTarget?.type === 'organization' ? {
    id: selectedTarget.organizationId,
    websiteUrl: selectedTarget.url
  } : null}
  onRunAudit={handleStartAudit}
  isRunning={isRunning}
>
  <SampleSizeSelector
    value={sampleSize}
    onChange={setSampleSize}
    pagesFound={aioAudit.pagesFound}
    disabled={isRunning}
  />
</AuditRunControl>
```
