# Re-run Single Check Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow developers to re-run a specific failing check against its affected pages to verify fixes, overwriting existing results in the same audit.

**Architecture:** A "Re-run" button in the grouped check footer calls a server action that re-fetches HTML for each failing page URL, re-runs the check definition, deletes old results, and inserts new ones. The UI refreshes via `router.refresh()`.

**Tech Stack:** Next.js server actions, Supabase, existing `fetchPage` + `buildCheckRecord` + check definitions.

---

### Task 1: Add check lookup helper

**Files:**

- Modify: `lib/unified-audit/checks/index.ts`

**Step 1: Add `getCheckByName` function**

After the existing `getChecksByCategory` function (~line 30), add:

```typescript
export function getCheckByName(name: string): AuditCheckDefinition | undefined {
  return allChecks.find((c) => c.name === name)
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit lib/unified-audit/checks/index.ts 2>&1 | head -5`

**Step 3: Commit**

```bash
git add lib/unified-audit/checks/index.ts
git commit -m "feat: add getCheckByName lookup helper"
```

---

### Task 2: Create `rerunCheck` server action

**Files:**

- Modify: `app/(authenticated)/seo/audit/[id]/actions.ts`

**Step 1: Add the server action**

Add imports at top of file:

```typescript
import { fetchPage } from '@/lib/audit/fetcher'
import { getCheckByName } from '@/lib/unified-audit/checks'
import { buildCheckRecord } from '@/lib/unified-audit/runner'
import { createServiceClient } from '@/lib/supabase/server'
import type { CheckContext } from '@/lib/unified-audit/types'
```

Add the action after existing exports:

```typescript
export interface RerunCheckResult {
  success: boolean
  updated: number
  passed: number
  failed: number
  warnings: number
  error?: string
}

export async function rerunCheck(
  auditId: string,
  checkName: string,
  pageUrls: string[]
): Promise<RerunCheckResult> {
  // Auth — use regular client for auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return {
      success: false,
      updated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      error: 'Not authenticated',
    }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()
  if (!userRecord)
    return {
      success: false,
      updated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      error: 'User not found',
    }

  // Verify audit access
  const { data: audit } = await supabase
    .from('audits')
    .select('id, organization_id, created_by')
    .eq('id', auditId)
    .single()
  if (!audit)
    return {
      success: false,
      updated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      error: 'Audit not found',
    }

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)
  if (!hasAccess)
    return { success: false, updated: 0, passed: 0, failed: 0, warnings: 0, error: 'Access denied' }

  // Look up check definition
  const checkDef = getCheckByName(checkName)
  if (!checkDef)
    return {
      success: false,
      updated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      error: 'Check not found',
    }
  if (checkDef.isSiteWide)
    return {
      success: false,
      updated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      error: 'Cannot re-run site-wide checks',
    }

  // Use service client for DB operations (bypasses RLS)
  const serviceClient = createServiceClient()

  const newChecks: AuditCheck[] = []
  const BATCH_SIZE = 5

  // Process pages in batches of 5
  for (let i = 0; i < pageUrls.length; i += BATCH_SIZE) {
    const batch = pageUrls.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (pageUrl) => {
        const { html, error } = await fetchPage(pageUrl)
        if (error || !html) return null

        const context: CheckContext = {
          url: pageUrl,
          html,
        }

        const result = await checkDef.run(context)
        return buildCheckRecord(auditId, pageUrl, checkDef, result)
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        newChecks.push(result.value)
      }
    }
  }

  if (newChecks.length === 0) {
    return {
      success: false,
      updated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      error: 'No pages could be fetched',
    }
  }

  // Delete old check rows for these page URLs
  await serviceClient
    .from('audit_checks')
    .delete()
    .eq('audit_id', auditId)
    .eq('check_name', checkName)
    .in('page_url', pageUrls)

  // Insert new check rows
  await serviceClient.from('audit_checks').insert(newChecks)

  const passed = newChecks.filter((c) => c.status === 'passed').length
  const failed = newChecks.filter((c) => c.status === 'failed').length
  const warnings = newChecks.filter((c) => c.status === 'warning').length

  return {
    success: true,
    updated: newChecks.length,
    passed,
    failed,
    warnings,
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep actions.ts`

**Step 3: Commit**

```bash
git add app/\(authenticated\)/seo/audit/\[id\]/actions.ts
git commit -m "feat: add rerunCheck server action"
```

---

### Task 3: Add `onRerunCheck` prop to `UnifiedCheckList`

**Files:**

- Modify: `components/audit/unified-check-list.tsx`

**Step 1: Update interfaces**

Add to `GroupedCheckItemProps` (~line 209):

```typescript
interface GroupedCheckItemProps {
  group: GroupedCheck
  totalPages?: number
  onDismiss?: (checkName: string, url: string) => Promise<void>
  onRerun?: (
    checkName: string,
    pageUrls: string[]
  ) => Promise<{ passed: number; failed: number; warnings: number }>
}
```

Add to `UnifiedCheckListProps` (~line 408):

```typescript
interface UnifiedCheckListProps {
  checks: AuditCheck[]
  groupBy?: 'category' | 'page'
  totalPages?: number
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
  onRerunCheck?: (
    checkName: string,
    pageUrls: string[]
  ) => Promise<{ passed: number; failed: number; warnings: number }>
}
```

**Step 2: Add `RotateCw` to lucide imports**

```typescript
import {
  ChevronDown,
  CheckCircle,
  Globe,
  ExternalLink,
  Info,
  Flag,
  Loader2,
  RotateCw,
} from 'lucide-react'
```

**Step 3: Add re-run state and handler to `GroupedCheckItem`**

In the component destructuring, add the prop:

```typescript
function GroupedCheckItem({ group, totalPages, onDismiss, onRerun }: GroupedCheckItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunProgress, setRerunProgress] = useState('')
  const [showAllPages, setShowAllPages] = useState(false)
```

Add the handler after `handleDismiss`:

```typescript
const handleRerun = async () => {
  if (!onRerun || affectedPageCount === 0) return
  setIsRerunning(true)
  setRerunProgress(
    `Re-checking ${pageEntries.length} page${pageEntries.length !== 1 ? 's' : ''}...`
  )
  try {
    const urls = instances
      .filter((i) => i.page_url && i.status !== CheckStatus.Passed)
      .map((i) => i.page_url!)
    await onRerun(check.check_name, urls)
  } finally {
    setIsRerunning(false)
    setRerunProgress('')
  }
}
```

**Step 4: Add re-run button to footer**

In the footer section, add the re-run button right-aligned. Replace the existing footer block with:

```tsx
{
  /* Footer with fix guidance + dismiss + re-run */
}
{
  ;(check.fix_guidance && check.fix_guidance !== detailMessage) ||
  (onDismiss && worstStatus !== CheckStatus.Passed) ||
  (onRerun && affectedPageCount > 0 && worstStatus !== CheckStatus.Passed) ? (
    <div className="border-border/50 flex gap-3 border-t px-6 py-4">
      <span className="shrink-0 text-lg leading-none opacity-0" aria-hidden="true">
        {getStatusIcon(worstStatus)}
      </span>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {check.fix_guidance && check.fix_guidance !== detailMessage && (
            <div className="flex items-start gap-2">
              <Info className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
              <p className="text-muted-foreground text-xs">{check.fix_guidance}</p>
            </div>
          )}
          {onDismiss && worstStatus !== CheckStatus.Passed && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-6 shrink-0 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
              disabled={isDismissing || isRerunning}
            >
              {isDismissing ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Flag className="mr-1 size-3" />
              )}
              Dismiss
            </Button>
          )}
        </div>
        {onRerun && affectedPageCount > 0 && worstStatus !== CheckStatus.Passed && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-6 shrink-0 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              handleRerun()
            }}
            disabled={isRerunning || isDismissing}
          >
            {isRerunning ? (
              <>
                <Loader2 className="mr-1 size-3 animate-spin" />
                {rerunProgress}
              </>
            ) : (
              <>
                <RotateCw className="mr-1 size-3" />
                Re-run
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  ) : null
}
```

**Step 5: Thread the prop through `CategoryGroupedCheckList`**

In `CategoryGroupedCheckList` type and component, add `onRerunCheck` prop and pass it to `GroupedCheckItem`:

```typescript
function CategoryGroupedCheckList({
  checks,
  totalPages,
  onDismissCheck,
  onRerunCheck,
}: {
  checks: AuditCheck[]
  totalPages?: number
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
  onRerunCheck?: (checkName: string, pageUrls: string[]) => Promise<{ passed: number; failed: number; warnings: number }>
}) {
```

In the `GroupedCheckItem` render:

```tsx
<GroupedCheckItem
  key={group.representative.check_name}
  group={group}
  totalPages={totalPages}
  onDismiss={onDismissCheck}
  onRerun={onRerunCheck}
/>
```

**Step 6: Thread through `UnifiedCheckList`**

```tsx
export function UnifiedCheckList({
  checks,
  groupBy = 'category',
  totalPages,
  onDismissCheck,
  onRerunCheck,
}: UnifiedCheckListProps) {
  // ...
  return (
    <CategoryGroupedCheckList
      checks={checks}
      totalPages={totalPages}
      onDismissCheck={onDismissCheck}
      onRerunCheck={onRerunCheck}
    />
  )
}
```

**Step 7: Commit**

```bash
git add components/audit/unified-check-list.tsx
git commit -m "feat: add re-run button to grouped check items"
```

---

### Task 4: Wire up in `client.tsx`

**Files:**

- Modify: `app/(authenticated)/seo/audit/[id]/client.tsx`

**Step 1: Import the server action and add router**

```typescript
import { rerunCheck } from './actions'
import { useRouter } from 'next/navigation'
```

**Step 2: Add the handler**

Inside `UnifiedAuditDetailClient`, add:

```typescript
const router = useRouter() // already exists in component

const handleRerunCheck = useCallback(
  async (checkName: string, pageUrls: string[]) => {
    const result = await rerunCheck(audit.id, checkName, pageUrls)
    if (result.success) {
      router.refresh()
    }
    return { passed: result.passed, failed: result.failed, warnings: result.warnings }
  },
  [audit.id, router]
)
```

**Step 3: Pass to all `UnifiedCheckList` instances**

Update all 4 instances to include `onRerunCheck`:

```tsx
<UnifiedCheckList
  checks={statusFilteredChecks}
  groupBy="category"
  totalPages={audit.pages_crawled}
  onRerunCheck={handleRerunCheck}
/>
```

(Repeat for seoChecks, performanceChecks, aiChecks tabs)

**Step 4: Verify build**

Run: `npm run build 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add app/\(authenticated\)/seo/audit/\[id\]/client.tsx
git commit -m "feat: wire rerunCheck into audit detail page"
```

---

### Task 5: Verify end-to-end

**Step 1: Run lint**

Run: `npm run lint`

**Step 2: Run format check**

Run: `npm run format:check`

**Step 3: Run unit tests**

Run: `npx vitest tests/unit/lib/unified-audit/ --run`

**Step 4: Run build**

Run: `npm run build`

**Step 5: Manual test**

1. Open an existing completed audit
2. Expand a failing page-specific check (e.g. "Images Missing Alt Text")
3. Verify "Re-run" button appears in the footer, right-aligned
4. Verify site-wide checks do NOT show the re-run button
5. Click "Re-run" — verify spinner and progress text
6. After completion — verify the check list refreshes with updated results

---

## Future: Broken Links Check (separate plan)

Add a page-specific check that parses all `<a href>` on each page, follows them, and reports which specific links on that page return 4xx/5xx. Different from the current site-wide `broken_internal_links` which only reports pages that are broken, not which pages link to them.
