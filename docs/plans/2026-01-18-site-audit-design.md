# SEO / AIO Site Audit Feature

> **Status:** Design Approved
> **Last updated:** 2026-01-18

---

## Changelog

| Date       | Update                          |
| ---------- | ------------------------------- |
| 2026-01-18 | Initial design document created |

---

## Overview

An internal tool for auditing websites to assess SEO health and AI-readiness. Users can run comprehensive site audits on their organization's website, view results in real-time, track improvements over time, and export branded PDF reports for sales conversations.

**Target user:** Internal sales team auditing prospect/client websites

**Entry point:** Sidebar menu item "SEO / AIO Audit"

---

## User Flow

1. **Submit URL** - Organization's `website_url` is pre-configured; user clicks "Run New Audit"
2. **Crawl in progress** - Page shows live progress indicator with pages discovered/scanned
3. **Results populate** - Checks appear in real-time grouped by type (SEO → AI-Readiness → Technical)
4. **Crawl complete** - Overall score animates in, AI-generated executive summary appears, "Export PDF" button becomes available
5. **View/Export** - User can drill into each check to see affected pages, export branded PDF

---

## Crawl Specification

| Setting              | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| Depth                | Full site crawl (follow all internal links)              |
| Max pages            | 200 pages (prevents runaway crawls)                      |
| Method               | HTTP client + Cheerio for HTML parsing                   |
| JavaScript rendering | Not included initially (can upgrade to Playwright later) |

---

## Audit Checks

### SEO Checks

| Check                               | Priority    | Description                              |
| ----------------------------------- | ----------- | ---------------------------------------- |
| Missing meta descriptions           | Critical    | Pages without meta description tags      |
| Meta descriptions too long/short    | Recommended | Outside 150-160 character range          |
| Missing or duplicate title tags     | Critical    | Pages without titles or with duplicates  |
| Title tags too long                 | Recommended | Over 60 characters (truncated in search) |
| Missing H1 tags                     | Critical    | Pages without a primary heading          |
| Multiple H1 tags                    | Recommended | More than one H1 per page                |
| Broken heading hierarchy            | Recommended | H3 before H2, skipped levels, etc.       |
| Images missing alt text             | Recommended | Accessibility and SEO impact             |
| Oversized images                    | Optional    | Images over 500KB affecting page speed   |
| Missing sitemap.xml                 | Critical    | No XML sitemap found                     |
| Missing or misconfigured robots.txt | Critical    | Blocks crawlers or missing entirely      |
| Broken internal links               | Critical    | 404s within the site                     |
| Missing canonical tags              | Recommended | Potential duplicate content issues       |
| Thin content pages                  | Optional    | Pages with very little text content      |

### AI-Readiness Checks

| Check                             | Priority    | Description                                    |
| --------------------------------- | ----------- | ---------------------------------------------- |
| Missing llms.txt                  | Critical    | No /llms.txt file for LLM crawlers             |
| AI crawlers blocked in robots.txt | Critical    | GPTBot, PerplexityBot, ClaudeBot, etc. blocked |
| Missing structured data (JSON-LD) | Critical    | No schema.org markup found                     |
| Incomplete structured data        | Recommended | Schema exists but missing key fields           |
| No FAQ content                    | Recommended | No FAQ pages or FAQ schema                     |
| Content not conversational        | Optional    | Content doesn't answer questions directly      |
| No recent content updates         | Recommended | Site hasn't been updated in 90+ days           |
| Missing markdown alternatives     | Optional    | No .md versions of key pages                   |

### Technical Checks

| Check                   | Priority    | Description                            |
| ----------------------- | ----------- | -------------------------------------- |
| Slow page load time     | Recommended | Pages taking over 3 seconds            |
| Not mobile-friendly     | Recommended | Viewport issues, touch target problems |
| Missing SSL/HTTPS       | Critical    | Site not secure                        |
| Mixed content warnings  | Recommended | HTTP resources on HTTPS pages          |
| Missing Open Graph tags | Optional    | No social sharing metadata             |
| Missing favicon         | Optional    | No favicon.ico                         |

---

## Scoring System

**Overall score:** 0-100 with letter grade (A/B/C/D/F)

**Category scores:**

- SEO Score (0-100)
- AI-Readiness Score (0-100)
- Technical Score (0-100)

**Calculation:** Weighted pass/fail ratio within each category, with Critical checks weighted higher than Recommended, and Recommended higher than Optional.

---

## AI Executive Summary

Generated after crawl completes using Claude via Vercel AI SDK.

**Prompt structure:**

```
You are writing an executive summary for a website audit report.

Site: {url}
Pages crawled: {count}
Overall Score: {score}/100

Results:
- SEO: {seo_score}/100 - {critical_fails} critical issues, {recommended_fails} recommended fixes
- AI-Readiness: {ai_score}/100 - {critical_fails} critical issues, {recommended_fails} recommended fixes
- Technical: {tech_score}/100 - {critical_fails} critical issues, {recommended_fails} recommended fixes

Top issues: {list of failed critical checks}

Write a 2-3 paragraph executive summary that:
1. Summarizes the overall health of the site
2. Highlights the most impactful issues to fix
3. Ends with an encouraging next step

Keep it non-technical and suitable for a business owner.
```

**Storage:** `site_audits.executive_summary` (text column)

**Display:** Top of in-app report and first content page of PDF export

---

## Data Model

### Organizations table (modification)

```sql
ALTER TABLE organizations
ADD COLUMN website_url text;
```

### New tables

```sql
-- Main audit record
CREATE TABLE site_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, crawling, completed, failed
  overall_score integer,
  seo_score integer,
  ai_readiness_score integer,
  technical_score integer,
  pages_crawled integer DEFAULT 0,
  executive_summary text,
  archived_at timestamptz, -- set when org URL changes
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Individual pages crawled
CREATE TABLE site_audit_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES site_audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  crawled_at timestamptz DEFAULT now()
);

-- Check results
CREATE TABLE site_audit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES site_audits(id) ON DELETE CASCADE,
  page_id uuid REFERENCES site_audit_pages(id) ON DELETE CASCADE, -- null for site-wide checks
  check_type text NOT NULL, -- seo, ai_readiness, technical
  check_name text NOT NULL, -- e.g., 'missing_meta_description'
  priority text NOT NULL, -- critical, recommended, optional
  status text NOT NULL, -- passed, failed, warning
  details jsonb, -- additional context/data
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_site_audits_org ON site_audits(organization_id);
CREATE INDEX idx_site_audits_archived ON site_audits(organization_id, archived_at);
CREATE INDEX idx_site_audit_pages_audit ON site_audit_pages(audit_id);
CREATE INDEX idx_site_audit_checks_audit ON site_audit_checks(audit_id);
```

---

## Technical Architecture

### API Routes

**`POST /api/audit/start`**

- Creates `site_audits` record with status `pending`
- Triggers background crawl job
- Returns audit ID immediately

**`GET /api/audit/[id]/status`**

- Returns current audit status, pages crawled, latest checks
- Client polls every 2-3 seconds during crawl

**`GET /api/audit/[id]`**

- Returns full audit results for completed audits

**`GET /api/audit/[id]/export`**

- Generates and returns PDF export

### Background Crawler

1. Fetch homepage, extract internal links
2. Queue discovered links, respect max page limit (200)
3. For each page:
   - Parse HTML with Cheerio
   - Extract metadata (title, description, headings, images, etc.)
   - Run all applicable checks
   - Save results to `site_audit_pages` and `site_audit_checks`
4. After crawl completes:
   - Calculate scores
   - Generate executive summary via Claude
   - Update `site_audits` status to `completed`

### Real-time Updates

- Client polls `/api/audit/[id]/status` every 2-3 seconds
- Response includes: status, pages_crawled, recent checks
- UI updates progress bar and results list incrementally
- Polling stops when status = `completed` or `failed`

---

## UI Specifications

### Sidebar

- Menu item: "SEO / AIO Audit"
- **Disabled state:** Grayed out and not clickable when `organization.website_url` is null

### Empty State Toast

When user logs in and `website_url` is empty:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Website URL not configured                         │
│                                                         │
│ Add your website URL to enable SEO & AI auditing.      │
│                                                [Set Up] │
└─────────────────────────────────────────────────────────┘
```

- "Set Up" button links to `/settings/organization`
- Dismisses once URL is configured

### Main Audit Page (`/audit`)

```
┌─────────────────────────────────────────────────────────┐
│  SEO / AIO Audit                                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │  example.com              [Run New Audit]       │   │
│  │  Organization URL                               │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Score History                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📈 [Sparkline/trend chart: 41 → 58 → 72]      │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Audit History                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Jan 18, 2026    72/100    47 pages    [View]    │  │
│  │ Dec 15, 2025    58/100    45 pages    [View]    │  │
│  │ Nov 20, 2025    41/100    42 pages    [View]    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ▼ Previous domain (archived)                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ old-site.com                                     │  │
│  │ Oct 1, 2025    65/100    32 pages    [View]     │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Audit Report View (`/audit/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Audits          [Export PDF]                 │
├─────────────────────────────────────────────────────────┤
│  example.com                                            │
│  Audited Jan 18, 2026 · 47 pages crawled               │
├─────────────────────────────────────────────────────────┤
│  Executive Summary                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ "Your website has a solid foundation but is     │   │
│  │ missing key elements for AI search visibility..." │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Overall  │  │   SEO    │  │    AI    │  │  Tech  │  │
│  │   72     │  │   81     │  │   58     │  │   77   │  │
│  │   /100   │  │   /100   │  │   /100   │  │  /100  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
├─────────────────────────────────────────────────────────┤
│  [Critical 3] [Recommended 12] [Optional 5] [Passed 28]│
├─────────────────────────────────────────────────────────┤
│  ▼ SEO Issues                                          │
│    ⛔ Missing meta descriptions (3 pages)         →    │
│    ⚠️ Title tags too long (8 pages)               →    │
│    ✓ All images have alt text                          │
│                                                         │
│  ▼ AI-Readiness Issues                                 │
│    ⛔ Missing llms.txt                            →    │
│    ⛔ AI crawlers blocked in robots.txt           →    │
│    ⚠️ No structured data found                    →    │
│                                                         │
│  ▼ Technical Issues                                    │
│    ✓ SSL configured correctly                          │
│    ⚠️ Slow page load (2 pages)                    →    │
└─────────────────────────────────────────────────────────┘
```

Expandable rows show list of affected pages with specific details.

---

## PDF Export

**Branding:** Selo Studios logo and colors

**Structure:**

1. **Cover page:** Logo, "Website Audit Report", domain, date
2. **Executive Summary + Scores:** AI-generated summary, score cards, key stats
3. **Detailed Findings:** All checks organized by type, with affected pages listed
4. **Next Steps:** CTA to contact Selo Studios

**Tech:** `@react-pdf/renderer` or Puppeteer to generate from React template

---

## URL Change Handling

When user edits `website_url` in organization settings and audits exist for the previous URL:

**Confirmation Dialog:**

```
┌─────────────────────────────────────────────────────────┐
│  Change Website URL?                                    │
├─────────────────────────────────────────────────────────┤
│  You have 3 audits for example.com.                    │
│                                                         │
│  Changing your website URL will:                        │
│  • Archive existing audits under "Previous domain"      │
│  • Start fresh audit history for newsite.com           │
│                                                         │
│  Archived audits will still be viewable but won't      │
│  appear in your score trend chart.                      │
│                                                         │
│                      [Cancel]  [Change URL]             │
└─────────────────────────────────────────────────────────┘
```

**Data handling:**

- Set `archived_at = now()` on all audits for the old URL
- Archived audits displayed in collapsible "Previous domain" section
- Trend chart only shows non-archived audits

---

## Future AI Enhancements

Documented for future phases:

| Enhancement                    | Description                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| **Auto-Generate Fixes**        | AI generates missing meta descriptions, llms.txt, JSON-LD schemas based on page content |
| **AI Search Simulation**       | Query ChatGPT/Perplexity with prompts about the brand, check if site gets cited         |
| **Competitive Gap Analysis**   | Compare audit results against competitor sites                                          |
| **Actionable Recommendations** | Context-aware suggestions instead of generic "Missing X" messages                       |
| **Content Quality Analysis**   | LLM scores content readability and how well it answers user questions                   |

---

## Open Questions

- [ ] Exact score weighting formula (Critical vs Recommended vs Optional)
- [ ] PDF library choice: `@react-pdf/renderer` vs Puppeteer
- [ ] Crawl rate limiting (requests per second to avoid overloading target sites)

---

## Next Steps

1. Add `website_url` column to organizations table
2. Create database migrations for audit tables
3. Build crawler service with Cheerio
4. Implement check functions for all 28 checks
5. Build audit UI pages
6. Integrate Claude for executive summary
7. Implement PDF export
