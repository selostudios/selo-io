# PageSpeed Progressive Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run mobile and desktop PageSpeed audits in parallel and display results as each completes.

**Architecture:** Modify the runner to use `Promise.all` for parallel device fetches, update progress tracking to count individual device results, and enhance the UI to show partial results while the audit is still running.

**Tech Stack:** Next.js, Supabase, TypeScript

---

## Task 1: Update Runner for Parallel Device Fetching

**Files:**

- Modify: `lib/performance/runner.ts`

**Step 1: Write the parallel fetch implementation**

Replace the sequential device loop with parallel execution:

```typescript
// Before (sequential):
for (const device of devices) {
  const result = await fetchPageSpeedInsights({ url, device })
  // ... insert result
}

// After (parallel):
const devicePromises = devices.map(async (device) => {
  try {
    await supabase
      .from('performance_audits')
      .update({
        current_device: device,
      })
      .eq('id', auditId)

    const result = await fetchPageSpeedInsights({ url, device })
    const metrics = extractMetrics(result)
    const additionalMetrics = extractAdditionalMetrics(result)
    const opportunities = extractOpportunities(result)
    const diagnostics = extractDiagnostics(result)

    await supabase.from('performance_audit_results').insert({
      audit_id: auditId,
      url,
      device,
      ...metrics,
      ...additionalMetrics,
      opportunities,
      diagnostics,
      raw_response: result,
    })

    return { device, success: true }
  } catch (error) {
    console.error(`[Performance Audit] ${device} failed for ${url}:`, error)
    return { device, success: false, error }
  }
})

const deviceResults = await Promise.all(devicePromises)
```

**Step 2: Update progress tracking**

Remove `current_device` from audit table updates since both run simultaneously. Keep `current_url` for display.

**Step 3: Test by running an audit**

Run: Start a PageSpeed audit and verify both devices run in parallel (audit should complete ~2x faster for single URL).

**Step 4: Commit**

```bash
git add lib/performance/runner.ts
git commit -m "perf: run mobile and desktop PageSpeed audits in parallel"
```

---

## Task 2: Update Progress Endpoint to Return Partial Results

**Files:**

- Modify: `app/api/performance/[id]/progress/route.ts`

**Step 1: Add device-specific counts to progress response**

```typescript
// Add counts per device
const { count: mobileCount } = await supabase
  .from('performance_audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('audit_id', id)
  .eq('device', 'mobile')

const { count: desktopCount } = await supabase
  .from('performance_audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('audit_id', id)
  .eq('device', 'desktop')

return NextResponse.json({
  ...audit,
  results_count: resultsCount ?? 0,
  mobile_results_count: mobileCount ?? 0,
  desktop_results_count: desktopCount ?? 0,
})
```

**Step 2: Commit**

```bash
git add app/api/performance/[id]/progress/route.ts
git commit -m "feat: add device-specific counts to progress endpoint"
```

---

## Task 3: Update Live Progress UI to Show Device Progress

**Files:**

- Modify: `components/performance/performance-live-progress.tsx`

**Step 1: Update progress type to include device counts**

```typescript
interface ProgressData {
  // ... existing fields
  mobile_results_count: number
  desktop_results_count: number
}
```

**Step 2: Simplify header - remove "Currently Auditing" section, move device info to subtitle**

Change the header from:

- Title: "Analyzing Pages..."
- Subtitle: "Testing X page(s) with PageSpeed Insights"
- Separate "Currently Auditing" box

To:

- Title: "Analyzing Pages"
- Subtitle: "Currently auditing [device] version with PageSpeed Insights" (dynamic based on what's running)
- Remove the "Currently Auditing" box entirely

```tsx
<CardHeader className="text-center">
  <div className="mb-4 flex justify-center">
    <Loader2 className="text-primary size-12 animate-spin" />
  </div>
  <CardTitle className="text-xl text-balance">
    {progress?.status === PerformanceAuditStatus.Pending ? 'Starting Audit...' : 'Analyzing Pages'}
  </CardTitle>
  <p className="text-muted-foreground text-sm text-pretty">{getProgressSubtitle()}</p>
</CardHeader>
```

Helper function for subtitle:

```typescript
const getProgressSubtitle = () => {
  const mobileComplete = (progress?.mobile_results_count ?? 0) >= totalUrls
  const desktopComplete = (progress?.desktop_results_count ?? 0) >= totalUrls

  if (mobileComplete && desktopComplete) {
    return 'Finishing up...'
  }
  if (!mobileComplete && !desktopComplete) {
    return 'Currently auditing mobile & desktop versions with PageSpeed Insights'
  }
  if (!mobileComplete) {
    return 'Currently auditing mobile version with PageSpeed Insights'
  }
  return 'Currently auditing desktop version with PageSpeed Insights'
}
```

**Step 3: Display device-specific progress in stats section**

Replace the single "Completed" stat with two device stats:

```tsx
<div className="flex gap-3">
  <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
    <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
      <Smartphone className="size-4" />
      Mobile
    </span>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold tabular-nums">
        {progress?.mobile_results_count ?? 0}/{totalUrls}
      </span>
      {(progress?.mobile_results_count ?? 0) >= totalUrls && (
        <CheckCircle2 className="size-5 text-green-500" />
      )}
    </div>
  </div>
  <div className="bg-muted/50 flex flex-1 items-center justify-between rounded-lg p-4">
    <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
      <Monitor className="size-4" />
      Desktop
    </span>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold tabular-nums">
        {progress?.desktop_results_count ?? 0}/{totalUrls}
      </span>
      {(progress?.desktop_results_count ?? 0) >= totalUrls && (
        <CheckCircle2 className="size-5 text-green-500" />
      )}
    </div>
  </div>
</div>
```

**Step 4: Commit**

```bash
git add components/performance/performance-live-progress.tsx
git commit -m "feat: show per-device progress in live progress UI"
```

---

## Task 4: Show Partial Results While Running

**Files:**

- Modify: `app/(authenticated)/seo/page-speed/[id]/page.tsx`
- Modify: `components/performance/performance-live-progress.tsx`

**Step 1: Fetch partial results in the page component**

Update the page to fetch and display results even when status is "running":

```typescript
// In page.tsx - fetch results regardless of status
const results = await getPerformanceAuditResults(id)

// Pass to client component
<PerformanceAuditDetail
  audit={audit}
  results={results}
  isRunning={audit.status === 'running'}
/>
```

**Step 2: Update live progress to accept and display partial results**

Add a results prop and render them below the progress indicator:

```tsx
interface PerformanceLiveProgressProps {
  auditId: string
  initialResults?: PerformanceAuditResult[]
}

// In the component, show results that have arrived
{
  results.length > 0 && (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-medium">Results so far:</h3>
      <PerformanceResults results={results} device={selectedDevice} />
    </div>
  )
}
```

**Step 3: Add polling for results (not just progress)**

Update the polling to also fetch new results:

```typescript
const fetchProgress = async () => {
  const [progressRes, resultsRes] = await Promise.all([
    fetch(`/api/performance/${auditId}/progress`),
    fetch(`/api/performance/${auditId}/results`),
  ])
  // Update both progress and results state
}
```

**Step 4: Commit**

```bash
git add app/(authenticated)/seo/page-speed/[id]/page.tsx
git add components/performance/performance-live-progress.tsx
git commit -m "feat: display partial results while audit is running"
```

---

## Task 5: Add Results Polling Endpoint

**Files:**

- Create: `app/api/performance/[id]/results/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: results, error } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(results)
}
```

**Step 2: Commit**

```bash
git add app/api/performance/[id]/results/route.ts
git commit -m "feat: add results polling endpoint for progressive display"
```

---

## Task 6: Update Types

**Files:**

- Modify: `lib/performance/types.ts`

**Step 1: Add progress response type**

```typescript
export interface PerformanceAuditProgress {
  id: string
  status: PerformanceAuditStatus
  current_url: string | null
  current_device: string | null
  total_urls: number
  completed_count: number
  started_at: string | null
  results_count: number
  mobile_results_count: number
  desktop_results_count: number
}
```

**Step 2: Commit**

```bash
git add lib/performance/types.ts
git commit -m "feat: add PerformanceAuditProgress type with device counts"
```

---

## Task 7: Final Verification

**Step 1: Run linter**

```bash
npm run lint
```

**Step 2: Run tests**

```bash
npm run test:unit
```

**Step 3: Build**

```bash
npm run build
```

**Step 4: Manual testing**

1. Start a PageSpeed audit
2. Verify mobile and desktop run in parallel (faster completion)
3. Verify progress shows per-device counts
4. Verify partial results display while running
5. Verify completed state shows all results

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint/test issues from progressive display"
```
