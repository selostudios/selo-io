# Performance Opportunities & Diagnostics Display

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display actionable opportunities and diagnostics from PageSpeed API data to help users improve their site performance.

**Architecture:** Reuse patterns from site audit CheckList/CheckItem components. Add collapsible sections below Core Web Vitals showing opportunities (with estimated savings) and diagnostics (with metric values).

**Tech Stack:** React, Recharts (existing), Tailwind CSS, Radix UI Collapsible

---

## Data Structure

### Opportunities (from `lighthouseResult.audits`)

Filter audits where `score < 1` and `numericValue > 0`:

```typescript
interface Opportunity {
  id: string                    // e.g., "render-blocking-resources"
  title: string                 // e.g., "Eliminate render-blocking resources"
  description: string           // Explanation of the issue
  score: number                 // 0-1 (0 = needs work, 1 = good)
  numericValue: number          // Savings in ms
  displayValue: string          // e.g., "Potential savings of 1,230 ms"
  details?: {
    items?: Array<{
      url?: string
      totalBytes?: number
      wastedBytes?: number
      wastedMs?: number
    }>
  }
}
```

### Diagnostics (from `lighthouseResult.audits`)

Filter audits that are informational (no savings, but have diagnostic value):

```typescript
interface Diagnostic {
  id: string                    // e.g., "dom-size"
  title: string                 // e.g., "Avoid an excessive DOM size"
  description: string           // Explanation
  displayValue: string          // e.g., "1,234 elements"
  details?: {
    items?: Array<Record<string, unknown>>
  }
}
```

---

## Component Design

### OpportunitiesList

Collapsible section following CheckList pattern:

```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Opportunities                    4 items · 2.3s savings   │
├─────────────────────────────────────────────────────────────┤
│   ⚠ Eliminate render-blocking resources         [Save 1.2s] │
│   ⚠ Remove unused JavaScript                    [Save 0.8s] │
│   ⚠ Serve images in next-gen formats            [Save 0.2s] │
│   ⚠ Efficiently encode images                   [Save 0.1s] │
└─────────────────────────────────────────────────────────────┘
```

### OpportunityItem (expanded)

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠ Eliminate render-blocking resources           [Save 1.2s] │
│                                                             │
│   Resources are blocking the first paint of your page.      │
│   Consider delivering critical JS/CSS inline...             │
│                                                             │
│   ▼ View 3 affected resources                               │
│     • /static/styles.css (45 KB, 500ms)                     │
│     • /static/bundle.js (120 KB, 730ms)                     │
│     • /static/vendor.js (85 KB, 200ms)                      │
└─────────────────────────────────────────────────────────────┘
```

### DiagnosticsList

```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Diagnostics                                      6 items  │
├─────────────────────────────────────────────────────────────┤
│   ℹ Avoid enormous network payloads                [3.2 MB] │
│   ℹ Avoid an excessive DOM size            [1,234 elements] │
│   ℹ Minimize main-thread work                       [4.5s]  │
└─────────────────────────────────────────────────────────────┘
```

### DiagnosticItem (expanded)

Same pattern as OpportunityItem but with info icon and neutral styling.

---

## File Structure

```
components/performance/
  opportunities-list.tsx     # Collapsible section wrapper
  opportunity-item.tsx       # Individual expandable item
  diagnostics-list.tsx       # Collapsible section wrapper
  diagnostic-item.tsx        # Individual expandable item

lib/performance/
  api.ts                     # Add extractOpportunities() and extractDiagnostics()
```

---

## UI Placement

In `performance-results.tsx`, add below Core Web Vitals:

```tsx
<CardContent className="space-y-6">
  {/* Lighthouse Scores */}
  <div>...</div>

  {/* Core Web Vitals */}
  <div>...</div>

  {/* Opportunities - collapsed by default */}
  {opportunities.length > 0 && (
    <OpportunitiesList opportunities={opportunities} />
  )}

  {/* Diagnostics - collapsed by default */}
  {diagnostics.length > 0 && (
    <DiagnosticsList diagnostics={diagnostics} />
  )}
</CardContent>
```

---

## Styling

- Reuse existing patterns from CheckList/CheckItem
- Warning icon (⚠) + yellow badge for opportunities
- Info icon (ℹ) + gray badge for diagnostics
- Collapsible sections start collapsed
- Items with highest impact sorted first

---

## Known Opportunity IDs to Extract

Priority opportunities (common high-impact items):
- `render-blocking-resources`
- `unused-javascript`
- `unused-css-rules`
- `offscreen-images`
- `unminified-javascript`
- `unminified-css`
- `modern-image-formats`
- `uses-optimized-images`
- `uses-responsive-images`
- `efficient-animated-content`
- `duplicated-javascript`
- `legacy-javascript`
- `total-byte-weight`

---

## Known Diagnostic IDs to Extract

Priority diagnostics:
- `dom-size`
- `total-byte-weight`
- `mainthread-work-breakdown`
- `bootup-time`
- `network-requests`
- `network-rtt`
- `network-server-latency`
- `critical-request-chains`
- `largest-contentful-paint-element`
- `layout-shift-elements`
- `long-tasks`
