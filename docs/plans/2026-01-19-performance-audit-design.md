# Performance Audit Feature Design

## Overview

Add a Performance Audit feature that leverages the Google PageSpeed Insights API to measure Core Web Vitals and Lighthouse scores for user-selected pages. This complements the existing SEO/AIO Site Audit by providing actionable performance metrics.

## Goals

- Measure Core Web Vitals (LCP, INP, CLS) for key pages
- Track Lighthouse performance scores over time
- Enable users to identify and prioritize performance improvements
- Integrate seamlessly with existing Site Audit workflow

## User Experience

### Entry Points

1. **Audit section tab**: New "Performance" tab alongside existing audit history
2. **From Site Audit report**: Speedometer icon on page rows to trigger performance audit for that specific URL

### Page Selection

Users can select pages to audit via:

- **Manual URL entry**: Type or paste URLs directly
- **Pick from crawled pages**: Select from pages discovered in previous Site Audits

Default behavior: Homepage is always included, users add additional key pages.

### Results Display

**Per-page metrics:**

- Core Web Vitals with pass/fail indicators:
  - LCP (Largest Contentful Paint) - target < 2.5s
  - INP (Interaction to Next Paint) - target < 200ms
  - CLS (Cumulative Layout Shift) - target < 0.1
- Lighthouse scores (0-100):
  - Performance
  - Accessibility
  - Best Practices
  - SEO

**Device toggle**: Mobile (primary/default) and Desktop views

**Trend charts**: Historical performance over time for tracked pages

## Technical Design

### Data Model

```sql
-- Performance audit runs
CREATE TABLE performance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  completed_at timestamptz
);

-- Individual page results within an audit
CREATE TABLE performance_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES performance_audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  device text NOT NULL CHECK (device IN ('mobile', 'desktop')),

  -- Core Web Vitals (field data from CrUX when available)
  lcp_ms integer,
  lcp_rating text CHECK (lcp_rating IN ('good', 'needs_improvement', 'poor')),
  inp_ms integer,
  inp_rating text CHECK (inp_rating IN ('good', 'needs_improvement', 'poor')),
  cls_score numeric(4,3),
  cls_rating text CHECK (cls_rating IN ('good', 'needs_improvement', 'poor')),

  -- Lighthouse scores (0-100)
  performance_score integer,
  accessibility_score integer,
  best_practices_score integer,
  seo_score integer,

  -- Raw API response for detailed diagnostics
  raw_response jsonb,

  created_at timestamptz DEFAULT now()
);

-- Track which pages user wants to monitor regularly
CREATE TABLE monitored_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  added_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES auth.users(id),
  UNIQUE(organization_id, url)
);
```

### API Integration

**PageSpeed Insights API:**

- Endpoint: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
- Parameters:
  - `url`: Page URL to analyze
  - `strategy`: `mobile` or `desktop`
  - `category`: `performance,accessibility,best-practices,seo`
  - `key`: API key (stored in environment)

**Rate limits:**

- Free tier: 25,000 queries/day
- Consider queuing for bulk audits

### File Structure

```
app/
  audit/
    performance/
      page.tsx              # Performance audit list/history
      [id]/
        page.tsx            # Performance audit results
      new/
        page.tsx            # Create new performance audit

lib/
  performance/
    api.ts                  # PageSpeed Insights API client
    types.ts                # TypeScript types

components/
  performance/
    performance-score-card.tsx    # Individual metric display
    core-web-vitals.tsx           # CWV section
    lighthouse-scores.tsx         # Lighthouse scores section
    trend-chart.tsx               # Historical trend visualization
    page-selector.tsx             # URL selection UI
```

### API Routes

```
POST /api/performance/start     # Start new performance audit
GET  /api/performance/[id]      # Get audit status/results
GET  /api/performance/history   # List past audits
POST /api/performance/monitor   # Add page to monitoring
```

## UI Components

### Performance Score Card

Circular gauge showing 0-100 score with color coding:

- 90-100: Green (good)
- 50-89: Orange (needs improvement)
- 0-49: Red (poor)

### Core Web Vitals Display

Three-column layout showing:

- Metric name and value
- Visual indicator (green/yellow/red)
- Target threshold

### Trend Chart

Line chart showing:

- X-axis: Date
- Y-axis: Score/metric value
- Separate lines for mobile vs desktop
- Hover for detailed values

## Automated Weekly Audits

A cron job runs weekly to automatically audit all monitored sites.

### Cron Job Design

**Trigger**: Weekly (e.g., Sunday at 2am UTC)

**Process**:

1. Query all organizations with active monitored sites
2. For each organization:
   - Run Site Audit on the primary site URL
   - Run Performance Audit on monitored pages
3. Store results in respective tables
4. (Future) Send summary email to organization admins

**Implementation options**:

1. **Vercel Cron**: Use `vercel.json` cron configuration

   ```json
   {
     "crons": [
       {
         "path": "/api/cron/weekly-audits",
         "schedule": "0 2 * * 0"
       }
     ]
   }
   ```

2. **Supabase pg_cron**: Database-level scheduling (requires setup)

3. **External service**: GitHub Actions, Railway cron, etc.

**Recommended**: Vercel Cron for simplicity since we're on Vercel.

### Cron API Route

```
POST /api/cron/weekly-audits
  - Authenticated via CRON_SECRET header
  - Iterates organizations
  - Queues audit jobs (to avoid timeout)
  - Returns summary of jobs queued
```

### Job Queue

For handling multiple audits without hitting Vercel timeout:

- Use Vercel's background functions or
- Queue jobs in database and process via separate endpoint
- Each audit runs independently

### Database Addition

```sql
-- Track sites to auto-audit weekly
CREATE TABLE monitored_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  run_site_audit boolean DEFAULT true,
  run_performance_audit boolean DEFAULT true,
  last_audit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, url)
);
```

## Implementation Phases

### Phase 1: Core Functionality

1. Database migrations
2. PageSpeed Insights API integration
3. Basic audit creation and results display
4. Mobile/desktop toggle

### Phase 2: Integration

1. Launch from Site Audit report
2. Page selector (manual + from crawled)
3. Monitored pages list

### Phase 3: History & Trends

1. Audit history list
2. Trend charts
3. Comparison views

### Phase 4: Automated Weekly Audits

1. Monitored sites table and UI
2. Cron job endpoint
3. Job queue for bulk processing

## Out of Scope (Future Enhancements)

- Alerts when scores drop below threshold
- Side-by-side comparison of two audit runs
- Automated fix suggestions
- Integration with CI/CD pipelines
- Competitor benchmarking
- Custom Lighthouse audits
- Summary email after weekly audits
