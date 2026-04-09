# AI Visibility Phase 4 — Dashboard & UI Design

## Overview

Four UI surfaces for the AI Visibility feature: an Overview dashboard, a Prompts management page, a Brand Mentions log, and a config section in org settings.

## Pages

### 1. Overview (`/{orgId}/ai-visibility`)

Server component fetches latest score data, renders client sub-components.

**Data:**

- Latest `ai_visibility_scores` row (score, mentions_count, citations_count, cited_pages_count, platform_breakdown)
- Previous score row for trend delta
- Score history (last 10 entries) for trend chart
- Config row for `is_active` and `last_sync_at`

**Layout (top to bottom):**

1. Header: title + "Sync Now" button + last synced timestamp
2. Hero card: ScoreRing (xl) left, ScoreTrendChart right, score label (Good/Needs Improvement/Poor) + delta
3. Metrics row: 3x MetricCard — Mentions, Citations, Cited Pages — with sparklines from score history
4. Platform Breakdown card: per-platform mentions and citations counts

**Empty state:** EmptyState with Eye icon + "Run your first sync" CTA when no scores exist.

No period selector — shows latest sync data.

### 2. Prompts (`/{orgId}/ai-visibility/prompts`)

**Data:**

- All `ai_visibility_topics` for the org
- All `ai_visibility_prompts` grouped by topic_id
- Latest `ai_visibility_results` per prompt per platform

**Layout:**

1. Header: title + "+ Add Prompt" button
2. Topic accordions (Collapsible): topic name + prompt count badge, first expanded
3. Prompt table per topic: Prompt text (truncated), Mentioned (e.g. "2/3"), Sentiment (colored dot), Last Queried. Row expands to show per-platform detail (mentioned/cited/position, response snippet).

**Add Prompt:** Sheet/dialog with topic select (existing or new) + prompt textarea. Server action creates topic + prompt.

No edit/delete for v1.

### 3. Brand Mentions (`/{orgId}/ai-visibility/mentions`)

Filterable log of results where `brand_mentioned = true`.

**Data:**

- `ai_visibility_results` joined with `ai_visibility_prompts` for prompt_text
- Filtered by platform, sentiment, date range
- Ordered by `queried_at` desc, paginated (20 per page, "Load more")

**Filters (URL search params):**

- Platform: All / ChatGPT / Claude / Perplexity
- Sentiment: All / Positive / Neutral / Negative
- Date range: Last 7 days / Last 30 days / Last 90 days

**Mention cards:**

- Header: prompt text (1 line)
- Meta: platform badge + sentiment badge + date
- Body: response snippet (200 chars, expandable)
- Footer: mentioned/cited chips, position (1st/2nd/3rd), competitor pills

### 4. Config UI (in `/{orgId}/settings/organization`)

New "AI Visibility" card in existing org settings page. Admin/internal only.

**Fields:**

- Active: toggle switch
- Platforms: checkbox group (ChatGPT, Claude, Perplexity), min 1 when active
- Sync Frequency: select (Daily, Weekly, Monthly)
- Monthly Budget: dollar input, stored as cents, min $1
- Alert Threshold: number input with %, default 90, range 50-100
- Competitors: repeatable name + domain rows, + Add button, max 10, remove button per row

**Server action:** `updateAIVisibilityConfig(orgId, data)` with `withAdminAuth`. Upserts config row — creates with defaults on first save.

## Reused Components

- `ScoreRing` from `components/reports/score-ring.tsx` — xl size for hero
- `ScoreTrendChart` pattern from `components/audit/score-trend-chart.tsx` — SVG line chart for score history
- `MetricCard` from `components/dashboard/metric-card.tsx` — mentions/citations/cited pages with sparklines
- `EmptyState` from `components/ui/empty-state.tsx` — all empty states
- Shadcn `Collapsible` — topic accordions on prompts page
- Shadcn `Select`, `Switch`, `Input` — config form fields

## New Components

- `components/ai-visibility/overview-dashboard.tsx` — client component orchestrating overview page
- `components/ai-visibility/platform-breakdown.tsx` — horizontal bar chart for platform stats
- `components/ai-visibility/prompt-accordion.tsx` — topic accordion with prompt table
- `components/ai-visibility/prompt-result-detail.tsx` — expandable per-platform results
- `components/ai-visibility/add-prompt-dialog.tsx` — sheet for adding new prompts
- `components/ai-visibility/mention-card.tsx` — individual mention result card
- `components/ai-visibility/mention-filters.tsx` — filter bar for mentions page
- `components/ai-visibility/config-form.tsx` — AI Visibility settings form

## Data Fetching Pattern

All pages are server components that fetch data and pass to client sub-components. This matches the existing dashboard pattern (RSC page -> client panel). Server actions handle mutations (sync, add prompt, update config).
