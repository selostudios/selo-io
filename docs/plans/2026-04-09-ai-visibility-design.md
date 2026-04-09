# AI Visibility Feature Design

## Overview

A new AI Visibility section in Selo that tracks how an organization's brand appears in AI-generated responses across ChatGPT, Claude, and Perplexity. Replaces the combined "SEO / AIO" nav header with two distinct sections: **SEO** (unchanged) and **AI Visibility** (new feature set + migrated AIO audit).

Inspired by SEMrush's AI Visibility toolkit but built as a first-party pipeline with per-platform adapters.

## Goals

- Track brand mentions, citations, and sentiment across AI platforms
- Surface an AI Visibility Score (0-100) with trends over time
- Allow auto-generated and manually created prompts organized by topics
- Enforce per-org monthly budgets with internal email alerts
- Make adding new AI platforms trivial via the adapter pattern
- Build with TDD — every component thoroughly tested

## Navigation Structure

```
SEO (existing, unchanged)
├── Full Site Audit
└── Client Reports

AI Visibility (new section)
├── Overview          ← Dashboard: score, mentions, citations, trends, platform distribution
├── Prompts           ← Manage tracked prompts & topics, view per-prompt results
├── Brand Mentions    ← Detailed mention/citation log with filtering
└── Site Audit        ← Existing AIO audit (technical AI readiness checks)
```

## Data Model

### ai_visibility_configs

One per organization. Stores sync preferences and budget.

| Column                 | Type             | Description                           |
| ---------------------- | ---------------- | ------------------------------------- |
| id                     | uuid PK          |                                       |
| organization_id        | uuid FK (unique) | References organizations              |
| sync_frequency         | text             | `daily` / `weekly` / `monthly`        |
| platforms              | text[]           | `['chatgpt', 'claude', 'perplexity']` |
| is_active              | boolean          | Whether sync is enabled               |
| monthly_budget_cents   | integer          | Default 10000 ($100)                  |
| budget_alert_threshold | integer          | Default 90 (percent)                  |
| last_alert_sent_at     | timestamptz      | Dedup alerts within a month           |
| last_alert_type        | text             | `approaching` / `exceeded`            |
| last_sync_at           | timestamptz      |                                       |
| created_at             | timestamptz      |                                       |
| updated_at             | timestamptz      |                                       |

### ai_visibility_topics

Grouping layer for prompts (e.g., "Prescription Glasses", "Brand vs Competitor").

| Column          | Type        | Description                 |
| --------------- | ----------- | --------------------------- |
| id              | uuid PK     |                             |
| organization_id | uuid FK     |                             |
| name            | text        | Topic display name          |
| source          | text        | `auto_generated` / `manual` |
| is_active       | boolean     |                             |
| metadata        | jsonb       | Industry tags, etc.         |
| created_at      | timestamptz |                             |
| updated_at      | timestamptz |                             |

### ai_visibility_prompts

Individual prompts sent to AI platforms.

| Column          | Type        | Description                     |
| --------------- | ----------- | ------------------------------- |
| id              | uuid PK     |                                 |
| topic_id        | uuid FK     | References ai_visibility_topics |
| organization_id | uuid FK     |                                 |
| prompt_text     | text        | The actual prompt               |
| source          | text        | `auto_generated` / `manual`     |
| is_active       | boolean     |                                 |
| created_at      | timestamptz |                                 |
| updated_at      | timestamptz |                                 |

### ai_visibility_results

One row per prompt + platform + sync run.

| Column              | Type        | Description                                                  |
| ------------------- | ----------- | ------------------------------------------------------------ |
| id                  | uuid PK     |                                                              |
| prompt_id           | uuid FK     |                                                              |
| organization_id     | uuid FK     |                                                              |
| platform            | text        | `chatgpt` / `claude` / `perplexity`                          |
| response_text       | text        | Full AI response                                             |
| brand_mentioned     | boolean     | Was the brand name found?                                    |
| brand_sentiment     | text        | `positive` / `neutral` / `negative`                          |
| brand_position      | integer     | Position in response (1=first third, 2=middle, 3=last third) |
| domain_cited        | boolean     | Was the org's domain cited?                                  |
| cited_urls          | text[]      | Specific URLs from org's domain found                        |
| competitor_mentions | jsonb       | `[{name, mentioned, cited}]`                                 |
| tokens_used         | integer     |                                                              |
| cost_cents          | integer     | Cost in cents for this query                                 |
| queried_at          | timestamptz | When the query was executed                                  |
| raw_response        | jsonb       | Full API response for debugging                              |
| created_at          | timestamptz |                                                              |

### ai_visibility_scores

Periodic score snapshots for trend charts.

| Column             | Type        | Description                             |
| ------------------ | ----------- | --------------------------------------- |
| id                 | uuid PK     |                                         |
| organization_id    | uuid FK     |                                         |
| score              | integer     | 0-100 composite score                   |
| mentions_count     | integer     | Total mentions this period              |
| citations_count    | integer     | Total citations this period             |
| cited_pages_count  | integer     | Unique pages cited                      |
| platform_breakdown | jsonb       | `{chatgpt: {mentions, citations}, ...}` |
| period_start       | date        |                                         |
| period_end         | date        |                                         |
| created_at         | timestamptz |                                         |

### RLS Policies

All tables follow the existing multi-tenant pattern:

- Users can only access rows matching their `organization_id` (via `team_members` join)
- Internal users (`is_internal = true`) can access all organizations
- Service client (cron jobs) bypasses RLS

## Platform Adapter Architecture

### Directory Structure

```
lib/ai-visibility/
├── platforms/
│   ├── types.ts              ← AIProviderAdapter interface, AIProviderResponse
│   ├── chatgpt/
│   │   ├── client.ts         ← OpenAI API client
│   │   └── adapter.ts        ← Implements AIProviderAdapter
│   ├── claude/
│   │   ├── client.ts         ← Anthropic API client
│   │   └── adapter.ts
│   └── perplexity/
│       ├── client.ts         ← Perplexity API client
│       └── adapter.ts
├── analyzer.ts               ← Analyze responses for mentions/citations/sentiment
├── prompt-generator.ts       ← Auto-generate prompts from org data
├── scorer.ts                 ← Calculate AI Visibility Score (0-100)
├── budget.ts                 ← Budget checking and enforcement
├── sync.ts                   ← Orchestrates the full sync pipeline
├── alerts.ts                 ← Budget alert email logic
└── types.ts                  ← Core types and enums
```

### Shared Adapter Interface

```typescript
interface AIProviderAdapter {
  platform: AIPlatform
  query(prompt: string): Promise<AIProviderResponse>
  extractCitations(response: AIProviderResponse): string[]
}

interface AIProviderResponse {
  text: string
  citations: string[] // URLs cited (Perplexity returns natively)
  model: string
  tokensUsed: number
  costCents: number
}
```

Each adapter handles its own:

- Authentication (API keys stored via existing app_settings pattern)
- Rate limiting (per-platform delays between calls)
- Response normalization to the shared `AIProviderResponse` format

### Adding a New Platform

1. Create `lib/ai-visibility/platforms/{name}/client.ts` and `adapter.ts`
2. Implement `AIProviderAdapter`
3. Add platform to `AIPlatform` enum
4. Register in adapter registry
5. Add mock fixture for tests

## Response Analysis Pipeline

Each `AIProviderResponse` passes through four analysis steps:

### 1. Brand Mention Detection

- Search response text for org name + configured aliases
- Case-insensitive, handles partial matches
- Returns: `mentioned: boolean`, `mentionCount: number`, `position: 1|2|3`

### 2. Citation Extraction

- Perplexity: extract from native citation array
- ChatGPT/Claude: parse response text for URLs matching org domain
- Returns: `domainCited: boolean`, `citedUrls: string[]`

### 3. Sentiment Analysis

- Batch classify all mention contexts via Claude API
- Uses structured output for reliable `positive`/`neutral`/`negative`
- Fallback to `neutral` on failure
- Cost tracked via `logUsage()`

### 4. Competitor Detection

- Scan responses for configured competitor names
- Returns: `[{name, mentioned, cited}]`

All steps are pure functions (except sentiment) and independently testable.

## Sync Pipeline

### Cron Job

`app/api/cron/ai-visibility-sync/route.ts`

- Runs daily (configurable per org)
- Validates `CRON_SECRET`
- Self-continues via POST on timeout (same pattern as batch crawler)

### Per-Org Sync Flow

```
1. Check budget: query current month spend via logUsage
   → If >= monthly_budget_cents: skip org, log warning

2. Load active prompts for org

3. For each platform in config.platforms:
   For each prompt (batched, rate-limited):
     a. adapter.query(prompt)
     b. analyzer.analyzeResponse(response, orgContext)
     c. Insert into ai_visibility_results
     d. logUsage('ai_visibility', platform, {orgId, cost})
     e. Re-check running spend total
        → If would exceed budget: stop, save partial results

4. Calculate daily score → insert into ai_visibility_scores

5. Update config.last_sync_at

6. Check budget thresholds → send alert email if crossed
```

### On-Demand Sync

Server action `runAIVisibilitySync(orgId)` runs the same pipeline for one org. Triggered by "Sync Now" button on dashboard.

## Feature-Level Cost Tracking

### Problem

The existing `logUsage()` system tracks by `service` (anthropic, pagespeed) and `event_type` (ai_analysis, psi_fetch), but can't answer "how much did AI Visibility cost for org X vs Client Reports?"

### Solution: `UsageFeature` Enum

Add a `feature` column to `usage_logs` that categorizes spend by product area:

```typescript
enum UsageFeature {
  SiteAudit = 'site_audit', // AI analysis + PSI in unified audits
  ClientReports = 'client_reports', // Executive summary generation
  AIVisibility = 'ai_visibility', // Brand monitoring queries + sentiment
}
```

This keeps `service` (which provider: anthropic, openai, perplexity, pagespeed) separate from `feature` (which product area). Enables two views:

- "How much are we spending on Anthropic across all features?"
- "How much is AI Visibility costing for org X?"

### Migration

- Add `feature text` column to `usage_logs` (nullable for backwards compat)
- Backfill existing rows: `ai_analysis` / `psi_fetch` → `site_audit`, `summary_generation` → `client_reports`

### `logUsage()` Update

```typescript
logUsage(service, eventType, {
  feature: UsageFeature.AIVisibility, // NEW
  organizationId,
  tokensInput,
  tokensOutput,
  cost,
  metadata,
})
```

### Existing Call Sites to Update

| File                               | event_type           | feature         |
| ---------------------------------- | -------------------- | --------------- |
| `lib/unified-audit/ai-runner.ts`   | `ai_analysis`        | `SiteAudit`     |
| `lib/unified-audit/psi-runner.ts`  | `psi_fetch`          | `SiteAudit`     |
| `lib/reports/summary-generator.ts` | `summary_generation` | `ClientReports` |

### Cost Surfacing in Org Settings

- **Feature breakdown**: Table or pie chart showing spend per feature (Site Audit, Client Reports, AI Visibility)
- **Service breakdown**: Secondary view showing spend per provider (Anthropic, OpenAI, Perplexity, PageSpeed)
- **Time range selector**: Current month, last 3 months, custom
- **Internal org list**: Total spend column with feature tooltip breakdown

### Budget Scope

Budgets on `ai_visibility_configs` apply specifically to the AI Visibility feature. Future features can have their own budgets. The `feature` column enables querying spend per feature accurately:

```sql
SELECT SUM(cost) FROM usage_logs
WHERE organization_id = $1
  AND feature = 'ai_visibility'
  AND created_at >= date_trunc('month', now())
```

## Budget System

### Enforcement

- `monthly_budget_cents` on config (default $100 = 10000)
- Checked before sync starts AND after each platform batch
- Partial results always saved (never throw away completed work)
- `canContinueSync(currentSpendCents, budgetCents): boolean` — pure function, easy to TDD

### Alerts

- **90% threshold**: Email to all `is_internal` users — "Heads up: {org} at 90% of AI Visibility budget"
- **100% exceeded**: Email to all `is_internal` users — "Budget exceeded: {org} syncs paused"
- Deduplication: `last_alert_sent_at` + `last_alert_type` on config, one email per threshold per month
- Uses existing React Email templates + Resend (production) / Mailpit (local)

### Cost Surfacing

- **Org settings page**: Budget config, current month spend bar, cost breakdown by platform
- **AI Visibility dashboard**: Banner when approaching limit
- **Internal org list**: Spend vs budget column for Selo team

## Score Calculation

AI Visibility Score (0-100) is a weighted composite:

```
score = (mentionRate * 40) + (citationRate * 40) + (sentimentScore * 20)

where:
  mentionRate   = (prompts with brand mentioned / total prompts) * 100
  citationRate  = (prompts with domain cited / total prompts) * 100
  sentimentScore = weighted average (positive=100, neutral=50, negative=0)
```

Score thresholds (same as existing audit scores):

- 80+: Good
- 60-79: Needs Improvement
- <60: Poor

## Implementation Phases

| Phase | Name                          | Status      | Notes                                            |
| ----- | ----------------------------- | ----------- | ------------------------------------------------ |
| 1     | Foundation                    | Done        | DB tables, types, enums, nav, stub pages         |
| 2     | Platform Adapters & Analysis  | Done        | 3 adapters, analyzer pipeline, scorer (56 tests) |
| 3     | Sync Pipeline & Cost Tracking | In Progress | Orchestrator, budget system, cron, alerts        |
| 4     | Dashboard & UI                | Not Started | Overview, prompts, mentions pages                |
| 5     | AIO Migration & Cleanup       | Not Started | Move AIO under AI Visibility nav                 |

### Phase 1 — Foundation (Done)

- Database migrations (all 5 AI Visibility tables + RLS policies)
- Add `feature` column to `usage_logs` + backfill migration
- Core types and enums (`AIPlatform`, `SyncFrequency`, `BrandSentiment`, `UsageFeature`, etc.)
- Update `logUsage()` signature and existing 3 call sites to pass `feature`
- Navigation restructure (split "SEO / AIO" → "SEO" + "AI Visibility")
- Stub pages for AI Visibility section

### Phase 2 — Platform Adapters & Analysis Pipeline (Done)

- `AIProviderAdapter` interface and cost estimation
- ChatGPT adapter (`@ai-sdk/openai`, gpt-4o-mini)
- Claude adapter (`@ai-sdk/anthropic`, claude-sonnet-4-20250514)
- Perplexity adapter (`@ai-sdk/perplexity`, sonar) with native citation extraction
- Adapter registry (`getAdapter`/`getAdapters`)
- Response analyzer: brand mention detection, citation extraction, competitor detection, sentiment analysis (batch + single)
- Composed `analyzeResponse()` function
- AI Visibility scorer (40% mentions + 40% citations + 20% sentiment)
- 56 tests across 9 test files

### Phase 3 — Sync Pipeline & Cost Tracking (In Progress)

- Competitors column migration on `ai_visibility_configs`
- Org context builder (brand name from org, domain from website_url)
- Budget module (spend tracking, threshold checks, dedup logic)
- Budget alert email template (React Email)
- Budget alert sender (emails to internal users)
- Sync orchestrator (`syncOrganization` — prompts x platforms loop with budget enforcement)
- Cron job (`ai-visibility-sync`, daily 4 AM UTC)
- On-demand sync server action

### Phase 4 — Dashboard & UI

- Overview page (score ring, trend line chart, platform distribution, mentions/citations/cited pages metrics)
- Prompts page (topic grouping, per-prompt results table, add custom prompt)
- Brand Mentions page (filterable log: platform, sentiment, date range)
- AI Visibility config UI in org settings (platforms, frequency, budget, competitors)

### Phase 5 — AIO Migration & Cleanup

- Move existing AIO audit under AI Visibility nav as "Site Audit"
- Remove old "SEO / AIO" combined header
- Update client reports to reference new nav structure
- Remove deprecation banners from old AIO pages
- Redirect old `/seo/aio/*` routes to new paths

## Testing Strategy

Each phase uses TDD:

- **Adapters**: Mock API responses as fixtures, test normalization and error handling
- **Analyzer**: Pure functions with comprehensive input/output test cases (mention detection edge cases, URL parsing, sentiment classification)
- **Scorer**: Pure function with known inputs → expected scores
- **Budget**: Pure functions for threshold checking, edge cases (exactly at limit, mid-sync overflow)
- **Sync pipeline**: Integration tests with mocked adapters, verifying database state after sync
- **UI components**: Testing Library for config forms, dashboard rendering with various data states
- **RLS policies**: Integration tests verifying tenant isolation (same pattern as existing RLS tests)
