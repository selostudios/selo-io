# Unified Audit System Design

**Date:** 2026-03-09
**Status:** Draft

## Overview

Consolidate three separate audit types (Site Audit, PageSpeed Audit, AIO Audit) into a single unified audit system. Add new GEO (Generative Engine Optimization) features from research into the geo-seo-claude toolkit. Enhance the report presentation for richer data and sales-oriented framing.

## Goals

1. **Single audit, single flow** — Users click one button, get one complete audit with three score dimensions
2. **Deduplicate checks** — Eliminate overlapping checks across the three current audit types (67 → 57 checks)
3. **Add GEO features** — 5 net new checks + 3 enhanced checks for AI search visibility
4. **Unified UI** — Tabbed view (Overview, SEO, Performance, AI Readiness) replacing 3 separate pages
5. **Enhanced report** — Richer data + sales-oriented framing for client presentations

## Architecture Decisions

### Audit Types

- **One-time audit** — Full audit, no organization, owned by `created_by`. For prospect qualification.
- **Organization audit** — Full audit, tied to an org, with history/trends over time.
- Same depth, same checks. Only difference is ownership and trend tracking.

### Crawl Modes

- **Standard** — Crawl up to N pages (default 50, configurable). Predictable time and cost.
- **Exhaustive** — No preset limit, follows all internal links until the entire site is mapped. Soft cap at 500 pages (configurable) — when reached, the audit pauses and prompts the user: "We've found 500+ pages, continue?" User can continue or stop with what's been crawled so far. Uses batch processing with self-triggering continuation for large sites.

### Score Dimensions

| Score        | Weight | Sources                                                                                                                |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| SEO          | 40%    | crawlability, meta-content, content-structure, content-quality, links, media, structured-data, security                |
| Performance  | 30%    | performance (PSI Lighthouse + CWV, normalized to check format)                                                         |
| AI Readiness | 30%    | ai-visibility, plus cross-cutting checks from crawlability, content-structure, content-quality, media, structured-data |
| **Overall**  | 100%   | Weighted composite of above three                                                                                      |

### Score Calculation

Same weighted formula as current system:

```
score = (earnedWeight / totalWeight) * 100
weight_multiplier: critical=3x, recommended=2x, optional=1x
point_multiplier: passed=100, warning=50, failed=0
```

Checks that feed multiple scores contribute to each independently.

AI Readiness score combines:

- Programmatic check results (same formula as above)
- Claude AI analysis strategic score (5 quality dimensions)
- Weight split: 40% programmatic + 60% AI analysis (when AI analysis is enabled)

---

## Check Registry (10 Categories, 57 Checks)

### 1. `crawlability` (7 checks → SEO + AI Readiness)

| Check                    | Priority | Site-wide | Status                                       | Notes                                                                                                                                                                                                                                                                     |
| ------------------------ | -------- | --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots-txt-validation`  | Critical | Yes       | Existing (merged from `missing-robots-txt`)  | Validates directives, sitemap ref, crawl rules                                                                                                                                                                                                                            |
| `ai-crawler-access`      | Critical | Yes       | **Enhanced**                                 | Per-bot breakdown for 14+ AI crawlers (GPTBot, ClaudeBot, PerplexityBot, GoogleExtended, Bytespider, CCBot, Amazonbot, FacebookBot, Applebot-Extended, Google-Extended, OAI-SearchBot, cohere-ai, YouBot, Diffbot) with individual allow/block status and recommendations |
| `sitemap-detection`      | Critical | Yes       | Existing (from `missing-sitemap`)            | Multi-path detection + robots.txt reference                                                                                                                                                                                                                               |
| `noindex-detection`      | Critical | No        | Existing (from `noindex-on-important-pages`) | Detects noindex preventing indexation                                                                                                                                                                                                                                     |
| `http-to-https-redirect` | Critical | Yes       | Existing                                     | Verifies HTTP → HTTPS redirect                                                                                                                                                                                                                                            |
| `llms-txt`               | Critical | Yes       | **Enhanced**                                 | 3-tier: missing (fail) → malformed/minimal (warning) → valid with proper sections (pass). Validates structure, section headers, sitemap reference                                                                                                                         |
| `js-rendering`           | Critical | No        | Deduplicated (merged site audit + AIO)       | SSR/CSR detection, framework identification                                                                                                                                                                                                                               |

### 2. `meta-content` (11 checks → SEO)

| Check                         | Priority    | Site-wide | Status   | Notes                           |
| ----------------------------- | ----------- | --------- | -------- | ------------------------------- |
| `missing-title`               | Critical    | No        | Existing |                                 |
| `title-length`                | Recommended | No        | Existing | 50-60 chars optimal             |
| `duplicate-titles`            | Critical    | Yes       | Existing |                                 |
| `missing-meta-description`    | Critical    | No        | Existing |                                 |
| `meta-description-length`     | Recommended | No        | Existing | 150-160 chars optimal           |
| `duplicate-meta-descriptions` | Recommended | Yes       | Existing |                                 |
| `missing-canonical`           | Recommended | No        | Existing |                                 |
| `canonical-validation`        | Recommended | No        | Existing | Accessibility, chains, self-ref |
| `missing-viewport`            | Recommended | No        | Existing |                                 |
| `missing-og-tags`             | Optional    | No        | Existing |                                 |
| `missing-favicon`             | Optional    | No        | Existing |                                 |

### 3. `content-structure` (9 checks → SEO + AI Readiness)

| Check                 | Priority    | Site-wide | Status                          | Notes                                                    |
| --------------------- | ----------- | --------- | ------------------------------- | -------------------------------------------------------- |
| `missing-h1`          | Critical    | No        | Existing                        |                                                          |
| `multiple-h1`         | Recommended | No        | Existing                        |                                                          |
| `heading-hierarchy`   | Recommended | No        | Existing                        | Feeds both SEO + AI Readiness                            |
| `faq-section`         | Recommended | No        | Deduplicated (site audit + AIO) | FAQ schema, headings, definition lists, details elements |
| `definition-boxes`    | Recommended | No        | Existing (AIO)                  | "What is X" patterns                                     |
| `step-by-step-guides` | Recommended | No        | Existing (AIO)                  | HowTo schema, ordered lists, step headings               |
| `summary-sections`    | Recommended | No        | Existing (AIO)                  | TL;DR, Key Takeaways sections                            |
| `citation-format`     | Recommended | No        | Existing (AIO)                  | External authoritative links, cite tags, references      |
| `comparison-tables`   | Optional    | No        | Existing (AIO)                  | Tables with headers, captions                            |

### 4. `content-quality` (5 checks → SEO + AI Readiness)

| Check                 | Priority    | Site-wide | Status                                    | Notes                                                              |
| --------------------- | ----------- | --------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `content-depth`       | Recommended | No        | Merged (`thin-content` + `content-depth`) | Tiered: <300 fail, 300-800 warning, 800-1500 pass, >1500 excellent |
| `readability`         | Recommended | No        | Existing (AIO)                            | Flesch Reading Ease (60+ pass, 40-60 warning, <40 fail)            |
| `paragraph-structure` | Recommended | No        | Existing (AIO)                            | Avg 40-100 words, no >150 word paragraphs                          |
| `list-usage`          | Recommended | No        | Existing (AIO)                            | 3+ item lists, density checks                                      |
| `content-freshness`   | Recommended | No        | Deduplicated (from `no-recent-updates`)   | <90 days pass, 90-365 warning, >365 fail                           |

### 5. `links` (4 checks → SEO)

| Check                   | Priority    | Site-wide | Status         | Notes                        |
| ----------------------- | ----------- | --------- | -------------- | ---------------------------- |
| `broken-internal-links` | Critical    | Yes       | Existing       | 4xx/5xx with status grouping |
| `redirect-chains`       | Recommended | Yes       | Existing       | Multi-hop detection          |
| `internal-linking`      | Recommended | No        | Existing (AIO) | Feeds SEO + AI Readiness     |
| `non-descriptive-url`   | Recommended | No        | Existing       | URL structure readability    |

### 6. `media` (3 checks → SEO + AI Readiness)

| Check                | Priority    | Site-wide | Status         | Notes                                  |
| -------------------- | ----------- | --------- | -------------- | -------------------------------------- |
| `images-missing-alt` | Recommended | No        | Existing       | Feeds SEO + AI Readiness               |
| `oversized-images`   | Optional    | No        | Existing       |                                        |
| `media-richness`     | Optional    | No        | Existing (AIO) | Images with alt, videos, media density |

### 7. `structured-data` (4 checks → SEO + AI Readiness)

| Check                 | Priority    | Site-wide | Status                          | Notes                                                                                                                                       |
| --------------------- | ----------- | --------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema-markup`       | Critical    | No        | Deduplicated (site audit + AIO) | JSON-LD presence, prioritizes Article, FAQPage, HowTo, Organization, Product                                                                |
| `organization-schema` | Critical    | Yes       | **Enhanced**                    | Presence + `sameAs` validation (social profiles, Wikipedia, Wikidata links). Entity linking signal for AI discoverability                   |
| `speakable-schema`    | Recommended | No        | **New**                         | Checks for `speakable` property on Article/WebPage schema. Tells AI assistants which content blocks are suitable for voice/text responses   |
| `schema-validation`   | Recommended | No        | **New**                         | Validates existing JSON-LD correctness: required properties (Article has author/datePublished, Organization has name/url/logo), valid types |

### 8. `security` (2 checks → SEO)

| Check             | Priority    | Site-wide | Status                         | Notes                            |
| ----------------- | ----------- | --------- | ------------------------------ | -------------------------------- |
| `ssl-certificate` | Critical    | Yes       | Deduplicated (merged 3 checks) | Presence + validity in one check |
| `mixed-content`   | Recommended | No        | Existing                       | HTTP resources on HTTPS pages    |

### 9. `performance` (4 checks → Performance)

| Check                | Priority    | Site-wide | Status                          | Notes                                                                                                                                                          |
| -------------------- | ----------- | --------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page-response-time` | Recommended | No        | Deduplicated (site audit + AIO) | Measured response time                                                                                                                                         |
| `lighthouse-scores`  | Critical    | No        | Existing (normalized)           | PSI API performance/accessibility/best-practices/seo scores. Normalized to check format: pass (≥90) / warning (50-89) / fail (<50). Raw scores in details JSON |
| `core-web-vitals`    | Critical    | No        | Existing (normalized)           | LCP, INP, CLS from PSI. Normalized to check format using Google's good/needs-improvement/poor thresholds. Raw metrics in details JSON                          |
| `mobile-friendly`    | Recommended | No        | Existing (AIO)                  | Viewport, media queries, fixed-width detection                                                                                                                 |

### 10. `ai-visibility` (8 checks → AI Readiness)

| Check                   | Priority    | Site-wide | Status                             | Notes                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------- | --------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-crawler-breakdown`  | Critical    | Yes       | **New**                            | Per-bot status table for 14+ AI crawlers. Shows allow/block/no-rule for each. Recommendations per blocked bot. Distinct from `ai-crawler-access` in crawlability which is the pass/fail check — this is the detailed breakdown view                                                                  |
| `llms-txt-validation`   | Critical    | Yes       | **Enhanced**                       | 3-tier validation with format/section checking. Distinct from `llms-txt` in crawlability — wait, these should be the same check. See note below.                                                                                                                                                     |
| `citability`            | Critical    | No        | **New**                            | Dual approach: (1) Programmatic baseline — passage length analysis, definition pattern detection, stat density, self-containment scoring. (2) Claude AI analysis — deep passage-level scoring in the AI analysis phase. Programmatic check gives quick pass/fail, AI phase provides the rich detail. |
| `brand-mentions`        | Recommended | Yes       | **New**                            | Automated: Wikipedia API + Wikidata API entity search. Reports knowledge graph presence, entity type, description. Surfaces gaps ("No Wikipedia article found", "No Wikidata entity").                                                                                                               |
| `platform-readiness`    | Recommended | Yes       | **New**                            | Claude AI analysis evaluates readiness for ChatGPT, Perplexity, Google AIO, Gemini, Bing Copilot. Per-platform sub-scores based on content structure, source authority, technical signals. Runs as part of AI analysis phase.                                                                        |
| `content-accessibility` | Recommended | No        | Existing (AIO)                     | ARIA landmarks, lang attribute, skip links                                                                                                                                                                                                                                                           |
| `html-structure`        | Recommended | No        | Existing (AIO)                     | Semantic HTML5, div ratio <40%                                                                                                                                                                                                                                                                       |
| `markdown-availability` | Optional    | Yes       | Existing (from `missing-markdown`) | /llms-full.txt or .md alternatives                                                                                                                                                                                                                                                                   |

**Note:** `ai-crawler-access` (crawlability) and `ai-crawler-breakdown` (ai-visibility) should be **one check** with two display modes. The check runs once, produces per-bot data. Crawlability score gets the pass/fail. AI Readiness tab shows the full breakdown. Same for `llms-txt` / `llms-txt-validation` — one check, displayed in both tabs.

**Revised totals:** 55 unique checks (not 57 — removed 2 duplicates from the cross-tab display).

---

## Execution Flow

```
User clicks "Run Audit"
│
├─ Phase 1: Crawl
│   └─ Standard mode: crawl up to max_pages (default 50)
│   └─ Exhaustive mode: crawl all internal links, pause at soft cap (default 500)
│   │   └─ Status → `awaiting_confirmation` when soft cap reached
│   │   └─ User confirms continue or proceed with current pages
│   └─ Collect HTML, build page list
│   └─ Batch processing with self-triggering continuation (existing pattern)
│   └─ Progress: "Crawling... 23/50 pages" or "Crawling... 347 pages discovered"
│
├─ Phase 2: Analysis (all parallel after crawl completes)
│   ├─ Programmatic checks (all 10 categories)
│   │   └─ Progress: "Running checks... 38/55 complete"
│   ├─ Performance - PSI API (top pages, mobile + desktop)
│   │   └─ Progress: "Performance... 3/8 pages (mobile)"
│   └─ Claude AI analysis (top pages by importance)
│       └─ Progress: "AI Analysis... 2/5 pages"
│
├─ Phase 3: Scoring (after all Phase 2 completes)
│   ├─ SEO score (from relevant checks, weighted formula)
│   ├─ Performance score (from PSI checks, weighted formula)
│   ├─ AI Readiness score (40% programmatic + 60% AI analysis)
│   └─ Overall score (SEO 40% + Performance 30% + AI Readiness 30%)
│
└─ Complete
```

### Progress Display

```
Phase 1: Crawling              ✅ Complete (47 pages)
Phase 2: Analyzing
  ├─ Programmatic checks       ✅ Complete (55 checks)
  ├─ Performance (PSI)         🔄 Running (3/8 pages)
  └─ AI Analysis (Claude)      ⏳ Queued (0/5 pages)
Phase 3: Scoring               ⏳ Waiting
```

---

## Database Schema

### Clean Break Strategy

- New unified tables created alongside existing tables
- Existing `site_audits`, `performance_audits`, `aio_audits` (and related) remain readable
- New audits use unified system only
- Old tables deprecated, eventual cleanup migration

### New Tables

#### `audits`

| Column                | Type               | Notes                                                                                                          |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `id`                  | uuid               | PK                                                                                                             |
| `organization_id`     | uuid (nullable)    | FK → organizations. Null for one-time audits                                                                   |
| `created_by`          | uuid (nullable)    | FK → auth.users. Owner for one-time audits                                                                     |
| `domain`              | text               | Extracted from URL                                                                                             |
| `url`                 | text               | Starting URL                                                                                                   |
| `status`              | enum               | `pending`, `crawling`, `awaiting_confirmation`, `checking`, `completed`, `failed`, `stopped`, `batch_complete` |
| `seo_score`           | integer (nullable) | 0-100                                                                                                          |
| `performance_score`   | integer (nullable) | 0-100                                                                                                          |
| `ai_readiness_score`  | integer (nullable) | 0-100                                                                                                          |
| `overall_score`       | integer (nullable) | 0-100 weighted composite                                                                                       |
| `pages_crawled`       | integer            | Default 0                                                                                                      |
| `crawl_mode`          | text               | `standard` or `exhaustive`                                                                                     |
| `max_pages`           | integer            | Default 50 (standard) or 500 (exhaustive soft cap). Configurable.                                              |
| `soft_cap_reached`    | boolean            | Default false. True when exhaustive hits the cap and is awaiting user decision.                                |
| `passed_count`        | integer            | Default 0                                                                                                      |
| `warning_count`       | integer            | Default 0                                                                                                      |
| `failed_count`        | integer            | Default 0                                                                                                      |
| `ai_analysis_enabled` | boolean            | Default true                                                                                                   |
| `sample_size`         | integer            | Pages for AI analysis, default 5                                                                               |
| `total_input_tokens`  | integer            | Claude API usage                                                                                               |
| `total_output_tokens` | integer            | Claude API usage                                                                                               |
| `total_cost`          | decimal            | Claude API cost                                                                                                |
| `use_relaxed_ssl`     | boolean            | SSL fallback flag                                                                                              |
| `last_sync_at`        | timestamptz        | For cron scheduling                                                                                            |
| `started_at`          | timestamptz        |                                                                                                                |
| `completed_at`        | timestamptz        |                                                                                                                |
| `created_at`          | timestamptz        | Default now()                                                                                                  |
| `updated_at`          | timestamptz        | Default now()                                                                                                  |

#### `audit_pages`

| Column             | Type                   | Notes                 |
| ------------------ | ---------------------- | --------------------- |
| `id`               | uuid                   | PK                    |
| `audit_id`         | uuid                   | FK → audits           |
| `url`              | text                   |                       |
| `title`            | text (nullable)        | Extracted from HTML   |
| `meta_description` | text (nullable)        | Extracted from HTML   |
| `status_code`      | integer (nullable)     | HTTP response code    |
| `last_modified`    | timestamptz (nullable) | From headers          |
| `is_resource`      | boolean                | PDF, DOC, image, etc. |
| `resource_type`    | text (nullable)        |                       |
| `depth`            | integer                | Crawl depth from root |
| `created_at`       | timestamptz            | Default now()         |

#### `audit_checks`

| Column                | Type             | Notes                                                                                                                                                   |
| --------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | uuid             | PK                                                                                                                                                      |
| `audit_id`            | uuid             | FK → audits                                                                                                                                             |
| `page_url`            | text (nullable)  | Null for site-wide checks                                                                                                                               |
| `category`            | text             | `crawlability`, `meta-content`, `content-structure`, `content-quality`, `links`, `media`, `structured-data`, `security`, `performance`, `ai-visibility` |
| `check_name`          | text             | Unique check identifier                                                                                                                                 |
| `priority`            | text             | `critical`, `recommended`, `optional`                                                                                                                   |
| `status`              | text             | `passed`, `failed`, `warning`                                                                                                                           |
| `display_name`        | text             | Human-readable (fail state)                                                                                                                             |
| `display_name_passed` | text             | Human-readable (pass state)                                                                                                                             |
| `description`         | text             |                                                                                                                                                         |
| `fix_guidance`        | text (nullable)  |                                                                                                                                                         |
| `learn_more_url`      | text (nullable)  |                                                                                                                                                         |
| `details`             | jsonb (nullable) | Check-specific data (PSI raw scores, per-bot breakdown, etc.)                                                                                           |
| `feeds_scores`        | text[]           | Which scores this check feeds: `['seo']`, `['ai_readiness']`, `['seo', 'ai_readiness']`, `['performance']`                                              |
| `created_at`          | timestamptz      | Default now()                                                                                                                                           |

#### `audit_crawl_queue`

| Column       | Type        | Notes                                          |
| ------------ | ----------- | ---------------------------------------------- |
| `id`         | uuid        | PK                                             |
| `audit_id`   | uuid        | FK → audits                                    |
| `url`        | text        |                                                |
| `depth`      | integer     |                                                |
| `status`     | text        | `pending`, `processing`, `completed`, `failed` |
| `created_at` | timestamptz | Default now()                                  |

#### `audit_ai_analyses`

| Column                     | Type        | Notes                                                                           |
| -------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `id`                       | uuid        | PK                                                                              |
| `audit_id`                 | uuid        | FK → audits                                                                     |
| `page_url`                 | text        |                                                                                 |
| `importance_score`         | integer     | 0-100                                                                           |
| `importance_reasons`       | text[]      |                                                                                 |
| `score_data_quality`       | integer     | 0-100                                                                           |
| `score_expert_credibility` | integer     | 0-100                                                                           |
| `score_comprehensiveness`  | integer     | 0-100                                                                           |
| `score_citability`         | integer     | 0-100                                                                           |
| `score_authority`          | integer     | 0-100                                                                           |
| `score_overall`            | integer     | 0-100 weighted average                                                          |
| `findings`                 | jsonb       | Per-dimension findings                                                          |
| `recommendations`          | jsonb       | Max 10 per page                                                                 |
| `platform_readiness`       | jsonb       | Per-platform sub-scores (ChatGPT, Perplexity, Google AIO, Gemini, Bing Copilot) |
| `citability_passages`      | jsonb       | Passage-level citability analysis                                               |
| `input_tokens`             | integer     |                                                                                 |
| `output_tokens`            | integer     |                                                                                 |
| `cost`                     | decimal     |                                                                                 |
| `execution_time_ms`        | integer     |                                                                                 |
| `created_at`               | timestamptz | Default now()                                                                   |

### Indexes

```sql
-- Primary lookups
CREATE INDEX idx_audits_org ON audits(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_audits_created_by ON audits(created_by) WHERE organization_id IS NULL;
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_audits_status ON audits(status);

-- Check queries
CREATE INDEX idx_audit_checks_audit ON audit_checks(audit_id);
CREATE INDEX idx_audit_checks_category ON audit_checks(audit_id, category);
CREATE INDEX idx_audit_checks_status ON audit_checks(audit_id, status);

-- Page queries
CREATE INDEX idx_audit_pages_audit ON audit_pages(audit_id);

-- AI analysis
CREATE INDEX idx_audit_ai_analyses_audit ON audit_ai_analyses(audit_id);

-- Crawl queue
CREATE INDEX idx_audit_crawl_queue_audit_status ON audit_crawl_queue(audit_id, status);
```

### RLS Policies

```sql
-- Organization members can view their org's audits
CREATE POLICY "org_members_view" ON audits FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- One-time audit owners can view their own
CREATE POLICY "owner_view" ON audits FOR SELECT
  USING (organization_id IS NULL AND created_by = auth.uid());

-- Internal users can view all
CREATE POLICY "internal_view" ON audits FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true));

-- Similar INSERT/DELETE policies following existing patterns
-- Cascade policies on audit_checks, audit_pages, audit_ai_analyses, audit_crawl_queue
```

---

## UI Design

### Tabbed Audit View

#### Overview Tab (Default)

- **Overall score** — Large circular score visualization with status badge
- **Three score cards** — SEO (40%), Performance (30%), AI Readiness (30%) — each with score, status badge, trend sparkline (org audits only)
- **Top issues** — Critical failures across all categories, sorted by impact. Max 10 shown.
- **Quick stats** — Pages crawled, total checks, pass/fail/warning counts
- **Audit metadata** — Domain, date, duration, pages analyzed

#### SEO Tab

- **SEO score card** — Larger format with trend chart (org audits)
- **Check results** — Checks from: crawlability, meta-content, content-structure, content-quality, links, media, structured-data, security (filtered to checks that feed SEO score)
- **Filters** — By priority (critical/recommended/optional), status (passed/failed/warning), category
- **Per-page drill-down** — Click a page to see its specific check results

#### Performance Tab

- **Performance score card** — With trend chart
- **Core Web Vitals** — LCP, INP, CLS with good/needs-improvement/poor visual indicators
- **Lighthouse scores** — Performance, Accessibility, Best Practices, SEO sub-scores
- **Mobile vs Desktop** — Side-by-side comparison
- **Check results** — Performance category checks

#### AI Readiness Tab

Two sections:

**Section 1: Programmatic Checks**

- **AI Readiness score card** — With trend chart
- **Check results** — ai-visibility checks + cross-cutting checks from other categories that feed AI Readiness
- **Same filters** as SEO tab

**Section 2: AI Content Analysis** (when AI analysis enabled)

- **Quality dimension scores** — 5 radar/bar chart: Data Quality, Expert Credibility, Comprehensiveness, Citability, Authority
- **Per-page analysis** — Expandable cards showing each analyzed page with scores, findings, recommendations
- **Citability highlights** — Passage-level analysis showing which content blocks are most/least citable
- **Platform readiness** — Per-platform cards (ChatGPT, Perplexity, Google AIO, Gemini, Bing Copilot) with sub-scores and recommendations
- **Brand mentions** — Entity presence across Wikipedia/Wikidata with gap analysis

### Progress Display (During Audit)

```
Phase 1: Crawling              ✅ Complete (47 pages)
Phase 2: Analyzing
  ├─ Programmatic checks       ✅ Complete (55 checks)
  ├─ Performance (PSI)         🔄 Running (3/8 pages)
  └─ AI Analysis (Claude)      ⏳ Queued (0/5 pages)
Phase 3: Scoring               ⏳ Waiting
```

Real-time updates via polling (existing pattern).

---

## New & Enhanced Checks: Implementation Details

### Enhanced: `ai-crawler-access` (per-bot breakdown)

**Current:** Binary pass/fail — checks if any AI crawlers are blocked.
**New:** Parses robots.txt for 14+ specific AI crawler user-agents. Returns per-bot status.

```typescript
interface AICrawlerBreakdown {
  bots: {
    name: string // "GPTBot"
    userAgent: string // "GPTBot"
    owner: string // "OpenAI"
    status: 'allowed' | 'blocked' | 'no-rule'
    rule?: string // "Disallow: /" if blocked
  }[]
  allowedCount: number
  blockedCount: number
  criticalBlocked: string[] // GPTBot, ClaudeBot, PerplexityBot
}
```

**Pass/fail logic:**

- All critical bots allowed → pass
- Any critical bot blocked → fail
- Only non-critical bots blocked → warning

**AI crawlers to check:**

- Critical: GPTBot, ClaudeBot, PerplexityBot
- Important: GoogleExtended, Google-Extended, OAI-SearchBot, Bytespider
- Secondary: CCBot, Amazonbot, FacebookBot, Applebot-Extended, cohere-ai, YouBot, Diffbot

### Enhanced: `llms-txt` (3-tier validation)

**Current:** Binary — exists or doesn't.
**New:** Validates format and completeness.

```typescript
interface LlmsTxtValidation {
  exists: boolean
  url: string
  statusCode: number
  content?: string
  sections: {
    hasTitle: boolean
    hasDescription: boolean
    hasSitemapRef: boolean
    hasPageList: boolean
    sectionCount: number
  }
  tier: 'missing' | 'malformed' | 'minimal' | 'valid'
}
```

**Scoring:**

- Missing → fail
- Exists but malformed (not valid text, no sections) → fail
- Minimal (exists, some content, missing key sections) → warning
- Valid (proper sections, page list, description) → pass

### Enhanced: `organization-schema` (sameAs validation)

**Current:** Checks Organization schema presence with name/url/logo/description.
**New:** Also validates `sameAs` links for entity cross-referencing.

```typescript
interface OrganizationSchemaDetails {
  exists: boolean
  hasName: boolean
  hasUrl: boolean
  hasLogo: boolean
  hasDescription: boolean
  sameAs: {
    present: boolean
    links: string[]
    platforms: string[] // "linkedin", "twitter", "wikipedia", "github", etc.
    hasSocialProfiles: boolean
    hasWikipedia: boolean
    hasWikidata: boolean
    count: number
  }
}
```

**Scoring:**

- No Organization schema → fail
- Schema exists but no `sameAs` or missing critical fields → warning
- Schema with `sameAs` linking to 2+ platforms → pass

### New: `speakable-schema`

Checks for the `speakable` property on Article or WebPage schema. This property identifies content sections suitable for text-to-speech and AI assistant responses.

```typescript
interface SpeakableSchemaDetails {
  hasSpeakable: boolean
  schemaType: string // "Article", "WebPage"
  speakableSelectors: string[] // CSS selectors or xPaths
  speakableCount: number
}
```

**Scoring:**

- No speakable property on any schema → fail
- Speakable present on some pages → warning
- Speakable present with valid selectors → pass

### New: `schema-validation`

Validates existing JSON-LD for correctness beyond just presence.

```typescript
interface SchemaValidationDetails {
  schemas: {
    type: string // "Article", "Organization", etc.
    valid: boolean
    missingRequired: string[] // ["author", "datePublished"]
    missingRecommended: string[]
    warnings: string[]
  }[]
  totalSchemas: number
  validCount: number
  invalidCount: number
}
```

**Required properties by type:**

- Article: `headline`, `author`, `datePublished`, `image`
- Organization: `name`, `url`
- Product: `name`, `offers`
- FAQPage: `mainEntity` with Question/Answer pairs
- HowTo: `step` with at least 2 steps
- LocalBusiness: `name`, `address`, `telephone`

**Scoring:**

- Any schema with missing required properties → fail
- All required present, missing recommended → warning
- All properties valid → pass

### New: `citability` (programmatic baseline)

Analyzes content passages for AI citation readiness.

```typescript
interface CitabilityDetails {
  totalPassages: number
  citablePassages: number // Score >= 60
  averageScore: number
  passageAnalysis: {
    text: string // First 200 chars
    wordCount: number
    score: number // 0-100
    signals: {
      hasDefinitionPattern: boolean // "X is a..."
      hasStatistics: boolean // Numbers, percentages
      isSelfContained: boolean // Minimal pronoun dependency
      optimalLength: boolean // 100-200 words
      hasFactualClaims: boolean // Specific, verifiable statements
    }
  }[]
  topPassages: string[] // Best 3 passages for citation
}
```

**Scoring:**

- Average citability < 30 → fail
- Average 30-60 → warning
- Average 60+ → pass

**Programmatic signals:**

- Passage length in 100-200 word range (+20 pts)
- Definition patterns ("X is a", "X refers to") (+15 pts)
- Statistics/numbers present (+15 pts)
- Low pronoun density (self-contained) (+15 pts)
- Factual claim patterns (+15 pts)
- Proper heading context (+10 pts)
- List/structured format (+10 pts)

The Claude AI analysis phase provides deeper citability scoring per page in `audit_ai_analyses.citability_passages`.

### New: `brand-mentions`

Checks Wikipedia and Wikidata APIs for brand/entity presence.

```typescript
interface BrandMentionDetails {
  brandName: string
  wikipedia: {
    found: boolean
    articleUrl?: string
    extract?: string // First paragraph
    pageId?: number
  }
  wikidata: {
    found: boolean
    entityId?: string // "Q123456"
    entityUrl?: string
    description?: string
    entityType?: string // "company", "organization", etc.
    sameAs?: string[] // Cross-references
  }
  knowledgeGraphPresence: boolean // Has either Wikipedia or Wikidata
  gaps: string[] // ["No Wikipedia article", "No Wikidata entity"]
}
```

**Scoring:**

- No Wikipedia AND no Wikidata → fail
- One of the two present → warning
- Both present → pass

**Implementation:** Direct API calls to:

- `https://en.wikipedia.org/w/api.php?action=query&titles={brand}&prop=extracts`
- `https://www.wikidata.org/w/api.php?action=wbsearchentities&search={brand}`

### New: `platform-readiness` (Claude AI analysis)

This check runs as part of the Claude AI analysis phase, not programmatically. Claude evaluates the site's readiness for each AI platform.

Stored in `audit_ai_analyses.platform_readiness`:

```typescript
interface PlatformReadiness {
  platforms: {
    name: string // "ChatGPT", "Perplexity", "Google AIO", "Gemini", "Bing Copilot"
    score: number // 0-100
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }[]
  overallReadiness: number // Average across platforms
}
```

---

## Audit Scheduling (Cron)

The existing `weekly-audits` cron job is updated to create unified audits instead of three separate ones. Same schedule (Sunday 2 AM UTC).

For organizations with monitoring enabled:

1. Create a new unified `audits` record
2. Run the full execution flow (crawl → analyze → score)
3. Store results in unified tables

## Audit Cleanup

Same strategy as current:

- Keep checks/pages for most recent audit per organization
- Previous audits: scores retained for trends, detailed checks deleted
- One-time audits deleted entirely after 30 days
- All checks/pages older than 6 months deleted

Updated to target the new `audit_checks`, `audit_pages`, `audit_ai_analyses` tables.

## Check Dismissal

Carries forward. `dismissed_checks` table updated to reference new check names. Dismissed checks are excluded from score calculation and hidden from results (with toggle to show).

## Sharing

Existing `shared_links` system works with new audit type. Add `SharedResourceType.Audit` (or update existing audit types to point to unified audit).

---

## Report Enhancements (Separate Design)

The report presentation system will be enhanced in a follow-up design to include:

### Richer Data

- Per-bot AI crawler breakdown visualization
- Citability passage highlights with scores
- Platform readiness radar/comparison chart
- Brand mention gap analysis
- Schema validation details with fix suggestions
- Core Web Vitals visual indicators

### Sales-Oriented Framing

- Opportunity-cost framing ("You're invisible to ChatGPT because X")
- Projected impact of fixes ("Fixing these 3 issues could improve AI visibility by ~X%")
- Competitor context where available
- Clear service tie-ins ("Selo can implement these fixes")
- Priority matrix (impact vs effort) for recommended actions

This will be a separate design document once the unified audit system is built.

---

## Migration Plan

### Phase 1: Database & Core

1. Create new unified tables with migration
2. Add RLS policies
3. Create new enums for categories, check names
4. Build unified check registry (TypeScript)

### Phase 2: Check Implementation

1. Port existing checks into new category structure
2. Implement new checks (5 new + 3 enhanced)
3. Deduplicate merged checks
4. Build unified scoring calculator

### Phase 3: Execution Engine

1. Build unified audit runner (crawl → parallel analysis → scoring)
2. Integrate PSI API calls into check format
3. Update Claude AI analysis to include platform readiness + enhanced citability
4. Build progress tracking for phased execution

### Phase 4: UI

1. Build tabbed audit view (Overview, SEO, Performance, AI Readiness)
2. Build progress display component
3. Update audit creation flow (single "Run Audit" button)
4. Update navigation to remove separate audit pages

### Phase 5: Migration & Cleanup

1. Update cron jobs to use unified system
2. Update sharing to support new audit type
3. Update Quick Audit flow
4. Deprecation notices on old audit pages
5. Old tables remain readable but no new data written

### Phase 6: Report Enhancements (follow-up)

1. Design enhanced report presentation
2. Add new data visualizations
3. Add sales-oriented framing
4. Update report generation to pull from unified audit
