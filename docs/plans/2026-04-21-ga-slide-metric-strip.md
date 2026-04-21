# GA Slide Metric Strip Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the Google Analytics slide in the quarterly performance deck a three-card metric strip at the top (dashboard-style, on-brand indigo sparklines) and a text-table fallback in print mode, while keeping the AI's narrative bullets cohesive with the featured metrics.

**Architecture:** Introduce a single source of truth for which GA metrics are featured on the slide — `GA_FEATURED_METRICS` — consumed by the fetcher (to attach `timeseries`), the AI prompt (to anchor bullets), and the slide component (to render). Build a `GaBodySlide` that replaces `BodySlide` for the GA section only: screen mode emits the strip via a new `accent` variant of the dashboard `MetricCard`; print mode emits a compact text table. Narrative parsing is lifted into a shared helper so GA bullets render identically to every other slide.

**Tech Stack:** Next.js App Router RSC pages, React client components for chart rendering, recharts for sparklines (existing), Tailwind for styling, Vitest + Testing Library for tests.

---

## Context & constraints

- `ReviewDeck` currently ignores its `data` prop (`_data`). Section 3 of the design corrects this — we thread `data.ga` through to the slide.
- `MetricTriple.timeseries` is already optional on the type. Old snapshots without it render the card with value + delta only (no sparkline).
- Featured metric keys must match rows that exist in `campaign_metrics` for GA. The fetcher today registers `ga_active_users`, `ga_new_users`, `ga_sessions`, and traffic sources. The third featured metric in the design ("Engagement rate") is not currently in `GA_METRICS`; **confirm during Task 1 whether engagement rate is available, and substitute `ga_new_users` if it is not.**
- The deck emits two DOM trees: `.screen-only` (carousel) and `.print-only` (stacked). Charts live only on screen; a text table covers print.
- Design decisions locked in earlier conversation: layout **A** (strip above narrative), print **b** (text-table fallback), scope **a** (GA-specific for now), color **A+b1** (sparkline-only brand color; new `accent` variant on `MetricCard` so dashboard stays on orange).

---

## Task 1: Create GA_FEATURED_METRICS config

**Files:**

- Create: `lib/reviews/featured-metrics.ts`

**Step 1: Write the module**

```ts
export type MetricFormat = 'number' | 'percent'

export interface FeaturedMetric {
  key: string // matches SnapshotData.ga[key]
  label: string // card label, e.g. "Sessions"
  format: MetricFormat
}

export const GA_FEATURED_METRICS: readonly FeaturedMetric[] = [
  { key: 'ga_sessions', label: 'Sessions', format: 'number' },
  { key: 'ga_active_users', label: 'Active users', format: 'number' },
  // If ga_engagement_rate exists in campaign_metrics, swap to:
  //   { key: 'ga_engagement_rate', label: 'Engagement rate', format: 'percent' },
  // Otherwise keep new_users as the third metric:
  { key: 'ga_new_users', label: 'New users', format: 'number' },
] as const

export const GA_FEATURED_METRIC_KEYS: readonly string[] = GA_FEATURED_METRICS.map((m) => m.key)
```

**Step 2: Confirm engagement_rate availability**

```bash
# Sanity check the metric catalogue; pick one org with GA data
# Expected: either rows exist for ga_engagement_rate (then swap), or they don't (keep new_users)
```

**Step 3: Commit**

```bash
git add lib/reviews/featured-metrics.ts
git commit -m "feat(reviews): introduce GA_FEATURED_METRICS config"
```

---

## Task 2: Attach timeseries to featured GA metrics in the fetcher

**Files:**

- Modify: `lib/reviews/fetchers/ga.ts`
- Test: `tests/unit/lib/reviews/fetchers/ga.test.ts` (create if missing)

**Step 1: Write the failing test**

Assert: (a) every `GA_FEATURED_METRIC_KEYS` entry has `timeseries.current`, `timeseries.qoq`, `timeseries.yoy` populated with `{date, value}` rows; (b) non-featured metrics (e.g. `ga_traffic_direct`) still have no `timeseries`; (c) scalar fields (`current`, `qoq_delta_pct`, etc.) still match the existing behavior for featured metrics.

Mock Supabase in line with the pattern in `tests/unit/lib/reviews/actions.test.ts`.

**Step 2: Run test to verify it fails**

```
npx vitest run tests/unit/lib/reviews/fetchers/ga.test.ts
# Expected: FAIL — timeseries is undefined on featured metrics
```

**Step 3: Implement**

Change the `for (const metric of GA_METRICS)` block so that when the metric is a featured key, we build the triple AND attach `timeseries`:

```ts
import { GA_FEATURED_METRIC_KEYS } from '@/lib/reviews/featured-metrics'

// … inside the loop:
const triple = buildMetricTriple({
  current: seriesFor(main),
  qoq: seriesFor(qoq),
  yoy: seriesFor(yoy),
})

if (GA_FEATURED_METRIC_KEYS.includes(metric)) {
  const toSeries = (rows: typeof main) =>
    rows
      .filter((r) => r.metric_type === metric)
      .map((r) => ({ date: r.date as string, value: Number(r.value) }))
  triple.timeseries = {
    current: toSeries(main),
    qoq: toSeries(qoq),
    yoy: toSeries(yoy),
  }
}
result[metric] = triple
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/lib/reviews/fetchers/ga.test.ts
```

**Step 5: Commit**

```bash
git add lib/reviews/fetchers/ga.ts tests/unit/lib/reviews/fetchers/ga.test.ts
git commit -m "feat(reviews): attach daily timeseries to featured GA metrics"
```

---

## Task 3: Add `accent` variant to MetricCard

**Files:**

- Modify: `components/dashboard/metric-card.tsx`
- Test: `tests/unit/components/dashboard/metric-card.test.tsx` (extend)

**Step 1: Write the failing test**

Assert: rendering `<MetricCard variant="accent" … />` produces a sparkline whose stroke color resolves to the brand indigo token (not the default). Rendering without the prop keeps the existing default color. (Use `container.querySelector('path[stroke]')` to read the stroke attribute.)

**Step 2: Run test to verify it fails**

```
npx vitest run tests/unit/components/dashboard/metric-card.test.tsx
```

**Step 3: Implement**

Add an optional `variant?: 'default' | 'accent'` prop (default: `'default'`). When accent:

- Stroke: `var(--color-indigo-500)` — or a literal `oklch(...)` if no Tailwind CSS variable exists.
- Area fill: linear gradient `indigo-500/30 → purple-600/5`.
- Delta arrows/badges stay semantic (green/red) — do not touch.

Keep the existing `color` prop as an escape hatch. The variant is the common path for deck usage.

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/components/dashboard/metric-card.test.tsx
```

**Step 5: Commit**

```bash
git add components/dashboard/metric-card.tsx tests/unit/components/dashboard/metric-card.test.tsx
git commit -m "feat(dashboard): add accent variant to MetricCard for deck usage"
```

---

## Task 4: Extract shared narrative parser

**Files:**

- Create: `components/reviews/review-deck/parse-body-narrative.ts`
- Modify: `components/reviews/review-deck/body-slide.tsx`
- Test: `tests/unit/components/reviews/review-deck/parse-body-narrative.test.ts` (create)

**Step 1: Lift the existing narrative parser**

Find the parser inside `body-slide.tsx` that converts `- ` lines into `<ul>` and blank-line gaps into `<p>`. Move it into `parse-body-narrative.ts` as a pure function returning a typed AST (`{ kind: 'paragraph' | 'list', content: string | string[] }[]`). `BodySlide` imports and renders the AST.

**Step 2: Write a regression test for the parser**

Cover: (a) single-bullet block, (b) mixed paragraph + bullet list, (c) "Going well\n- …\n\nTo improve\n- …" split renders as two heading-like paragraphs + two lists, (d) trailing whitespace is ignored.

**Step 3: Confirm BodySlide still works**

```bash
npx vitest run tests/unit/components/reviews/review-deck
```

**Step 4: Commit**

```bash
git add components/reviews/review-deck tests/unit/components/reviews/review-deck
git commit -m "refactor(reviews): extract body narrative parser for reuse"
```

---

## Task 5: Build GaMetricStrip and GaMetricTable

**Files:**

- Create: `components/reviews/review-deck/ga-metric-strip.tsx`
- Create: `components/reviews/review-deck/ga-metric-table.tsx`
- Test: `tests/unit/components/reviews/review-deck/ga-metric-strip.test.tsx`
- Test: `tests/unit/components/reviews/review-deck/ga-metric-table.test.tsx`

**GaMetricStrip (screen):**

- Props: `{ data: GAData | undefined }`.
- Returns `null` when `data` is undefined or when none of the featured keys have triples.
- Renders a `grid grid-cols-1 md:grid-cols-3 gap-4` of `MetricCard variant="accent"` — one per featured metric that has a triple. Missing metrics are skipped (no placeholders).
- Passes `timeSeries={triple.timeseries?.current}` — when undefined, the card already handles it (no sparkline rendered).
- Formatters: `format === 'percent'` → append `%` to the value; `format === 'number'` → integer with thousands separators (which `MetricCard` already does).

**GaMetricTable (print):**

- Props: `{ data: GAData | undefined }`.
- Returns `null` when no data.
- Renders a 4-column `<table>` with headers `Metric | Current | QoQ | YoY`. Each row is one featured metric. Empty/null cells show `—`.
- Styled for print: `print:table`, `print:w-full`, small text, compact padding.

**Test coverage:**

- Strip: hides when `data` undefined; renders only present metrics; respects featured order; passes timeseries to cards when available; renders cards without sparklines when timeseries missing.
- Table: hides when `data` undefined; formats QoQ/YoY as percent with sign; em-dashes missing values; row order matches featured order.

**Step: Commit**

```bash
git add components/reviews/review-deck/ga-metric-strip.tsx components/reviews/review-deck/ga-metric-table.tsx tests/unit/components/reviews/review-deck
git commit -m "feat(reviews): add GA metric strip (screen) and table (print)"
```

---

## Task 6: Compose GaBodySlide

**Files:**

- Create: `components/reviews/review-deck/ga-body-slide.tsx`
- Test: `tests/unit/components/reviews/review-deck/ga-body-slide.test.tsx`

**Shape:**

```ts
interface Props {
  narrative: string
  data: GAData | undefined
  mode: 'screen' | 'print'
}
```

**Composition:**

```
<SlideContainer>
  <SectionHeading>Google Analytics</SectionHeading>
  {mode === 'screen' ? <GaMetricStrip data={data} /> : <GaMetricTable data={data} />}
  <NarrativeBlock>{parseBodyNarrative(narrative)}</NarrativeBlock>
</SlideContainer>
```

Reuse the same section heading component `BodySlide` uses. Reuse `parseBodyNarrative` from Task 4.

**Tests:** renders strip on screen mode, table on print mode, narrative always; no strip/table when `data` missing; narrative still renders with strip/table absent.

**Commit:**

```bash
git add components/reviews/review-deck/ga-body-slide.tsx tests/unit/components/reviews/review-deck/ga-body-slide.test.tsx
git commit -m "feat(reviews): compose GA body slide with metric strip above narrative"
```

---

## Task 7: Wire GaBodySlide into ReviewDeck

**Files:**

- Modify: `components/reviews/review-deck/index.tsx`

**Changes:**

1. Stop dropping the `data` prop — rename `_data` → `data` and thread it into body slide rendering.
2. Add a `component` field (or a discriminator) to `BODY_SECTIONS` so the GA section renders `GaBodySlide` and everything else renders `BodySlide`.
3. For the GA slide, pass `data={data?.ga}` and `mode={mode}`. For other slides, pass narrative only (unchanged API).
4. Do NOT change the API to `BodySlide` — keep it stable so LinkedIn/HubSpot slides keep working.

**Smoke test:** `npm run build`, then open a published report in the browser and confirm (a) the strip appears, (b) the narrative still reads correctly below it, (c) print preview shows the table instead of the strip.

**Commit:**

```bash
git add components/reviews/review-deck/index.tsx
git commit -m "feat(reviews): render GaBodySlide for the GA section in the deck"
```

---

## Task 8: Tell the AI what's on the slide

**Files:**

- Modify: `lib/reviews/narrative/prompts.ts`
- Test: `tests/unit/lib/reviews/narrative/prompts.test.ts` (extend; create if absent)

**Step 1: Update `defaultTemplateGaSummary`**

Prepend a bullet-anchoring paragraph built from `GA_FEATURED_METRICS`:

```ts
import { GA_FEATURED_METRICS } from '@/lib/reviews/featured-metrics'

export function defaultTemplateGaSummary(): string {
  const featured = GA_FEATURED_METRICS.map((m) => m.label).join(', ')
  return [
    `The slide displays metric cards for: ${featured}. Anchor the "Going well" and "To improve" bullets in these metrics first, so the bullets visibly match the numbers on the cards above. Secondary metrics can be referenced only when they add context the featured three cannot.`,
    '',
    // … existing body …
  ].join('\n')
}
```

**Step 2: Test**

Assert that the rendered prompt contains each featured metric label and the phrase "match the numbers on the cards above." Add a test that substitutes a shorter featured list via dependency-injection or module-mock to prove the list is dynamic.

**Step 3: Commit**

```bash
git add lib/reviews/narrative/prompts.ts tests/unit/lib/reviews/narrative/prompts.test.ts
git commit -m "feat(reviews): anchor GA narrative bullets to featured metric cards"
```

---

## Task 9: Final verification

**Steps:**

1. `npm run lint`
2. `npm run test:unit`
3. `npm run build`
4. Manually exercise: create a fresh quarterly review, open the GA slide, verify cards render with sparklines; open the preview's print view, verify the text table replaces the cards; open the public share link, verify same as authenticated preview; regenerate the narrative and confirm bullets mention the featured three metrics specifically.
5. Update Playwright visual snapshot for the performance report if the GA slide appears in baselines: `npm run test:e2e:update-snapshots` → review diff → commit.

**Commit any snapshot updates:**

```bash
git add tests/e2e/visual.spec.ts-snapshots
git commit -m "test(e2e): update performance report snapshot with GA metric strip"
```

---

## Open questions for execution time

- **Engagement rate availability** (Task 1). Confirm or substitute.
- **Exact indigo token** (Task 3). If Tailwind CSS variables for `indigo-500` aren't exposed via `--color-*`, fall back to an `oklch()` literal or pull from `globals.css`.
- **Print layout padding** (Task 7 smoke test). Expect the text table to need tighter padding than the strip — tweak in place if the A4 page looks imbalanced.

---

## What we're deliberately NOT doing in this plan

- No dashboard sparkline color change — the dashboard stays on its current default.
- No generalisation to LinkedIn/HubSpot slides — that's the next planning pass, informed by how this GA implementation actually feels.
- No backfill for pre-change snapshots — old snapshots keep rendering without sparklines. Only new snapshots get the richer `timeseries` payload.
- No author-level control over which metrics are featured — hardcoded set for v1.
- No E2E test additions beyond a snapshot refresh.
