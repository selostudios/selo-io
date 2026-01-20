# SEO / AIO Site Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an internal site audit tool that crawls websites, checks SEO and AI-readiness, generates AI summaries, and exports branded PDFs.

**Architecture:** Background crawler with real-time polling, 28 checks across 3 categories, Claude-powered executive summary, React PDF export. Organization-scoped with URL change archiving.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), Cheerio (HTML parsing), Vercel AI SDK (Claude), @react-pdf/renderer

**Design Doc:** `docs/plans/2026-01-18-site-audit-design.md`

---

## Phase 1: Database Schema

### Task 1: Add website_url to organizations

**Files:**

- Create: `supabase/migrations/XXXXXX_add_website_url_to_organizations.sql`

**Step 1: Create migration file**

```sql
-- Add website_url column to organizations
ALTER TABLE organizations
ADD COLUMN website_url text;

-- Add comment for documentation
COMMENT ON COLUMN organizations.website_url IS 'Primary website URL for SEO/AIO auditing';
```

**Step 2: Run migration locally**

Run: `npx supabase db reset`
Expected: Migration applies successfully

**Step 3: Verify column exists**

Run: `npx supabase db dump --local | grep website_url`
Expected: Shows `website_url text`

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add website_url column to organizations"
```

---

### Task 2: Create site_audits table

**Files:**

- Create: `supabase/migrations/XXXXXX_create_site_audits.sql`

**Step 1: Create migration file**

```sql
-- Create site_audits table
CREATE TABLE site_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  overall_score integer,
  seo_score integer,
  ai_readiness_score integer,
  technical_score integer,
  pages_crawled integer DEFAULT 0,
  executive_summary text,
  archived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for status
ALTER TABLE site_audits
ADD CONSTRAINT site_audits_status_check
CHECK (status IN ('pending', 'crawling', 'completed', 'failed'));

-- Add RLS policies
ALTER TABLE site_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's audits"
ON site_audits FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert audits for their organization"
ON site_audits FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their organization's audits"
ON site_audits FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_site_audits_org ON site_audits(organization_id);
CREATE INDEX idx_site_audits_archived ON site_audits(organization_id, archived_at);
```

**Step 2: Run migration**

Run: `npx supabase db reset`
Expected: Migration applies successfully

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create site_audits table with RLS"
```

---

### Task 3: Create site_audit_pages table

**Files:**

- Create: `supabase/migrations/XXXXXX_create_site_audit_pages.sql`

**Step 1: Create migration file**

```sql
-- Create site_audit_pages table
CREATE TABLE site_audit_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  status_code integer,
  crawled_at timestamptz DEFAULT now()
);

-- Add RLS policies (inherit from parent audit)
ALTER TABLE site_audit_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pages from their audits"
ON site_audit_pages FOR SELECT
USING (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert pages to their audits"
ON site_audit_pages FOR INSERT
WITH CHECK (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Create index
CREATE INDEX idx_site_audit_pages_audit ON site_audit_pages(audit_id);
```

**Step 2: Run migration**

Run: `npx supabase db reset`
Expected: Migration applies successfully

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create site_audit_pages table with RLS"
```

---

### Task 4: Create site_audit_checks table

**Files:**

- Create: `supabase/migrations/XXXXXX_create_site_audit_checks.sql`

**Step 1: Create migration file**

```sql
-- Create site_audit_checks table
CREATE TABLE site_audit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  page_id uuid REFERENCES site_audit_pages(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  check_name text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add check constraints
ALTER TABLE site_audit_checks
ADD CONSTRAINT site_audit_checks_type_check
CHECK (check_type IN ('seo', 'ai_readiness', 'technical'));

ALTER TABLE site_audit_checks
ADD CONSTRAINT site_audit_checks_priority_check
CHECK (priority IN ('critical', 'recommended', 'optional'));

ALTER TABLE site_audit_checks
ADD CONSTRAINT site_audit_checks_status_check
CHECK (status IN ('passed', 'failed', 'warning'));

-- Add RLS policies
ALTER TABLE site_audit_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checks from their audits"
ON site_audit_checks FOR SELECT
USING (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert checks to their audits"
ON site_audit_checks FOR INSERT
WITH CHECK (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Create indexes
CREATE INDEX idx_site_audit_checks_audit ON site_audit_checks(audit_id);
CREATE INDEX idx_site_audit_checks_page ON site_audit_checks(page_id);
```

**Step 2: Run migration**

Run: `npx supabase db reset`
Expected: Migration applies successfully

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create site_audit_checks table with RLS"
```

---

## Phase 2: TypeScript Types

### Task 5: Create audit types

**Files:**

- Create: `lib/audit/types.ts`

**Step 1: Create types file**

```typescript
export type AuditStatus = 'pending' | 'crawling' | 'completed' | 'failed'

export type CheckType = 'seo' | 'ai_readiness' | 'technical'

export type CheckPriority = 'critical' | 'recommended' | 'optional'

export type CheckStatus = 'passed' | 'failed' | 'warning'

export interface SiteAudit {
  id: string
  organization_id: string
  url: string
  status: AuditStatus
  overall_score: number | null
  seo_score: number | null
  ai_readiness_score: number | null
  technical_score: number | null
  pages_crawled: number
  executive_summary: string | null
  archived_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface SiteAuditPage {
  id: string
  audit_id: string
  url: string
  title: string | null
  status_code: number | null
  crawled_at: string
}

export interface SiteAuditCheck {
  id: string
  audit_id: string
  page_id: string | null
  check_type: CheckType
  check_name: string
  priority: CheckPriority
  status: CheckStatus
  details: Record<string, unknown> | null
  created_at: string
}

export interface AuditCheckDefinition {
  name: string
  type: CheckType
  priority: CheckPriority
  description: string
  run: (context: CheckContext) => Promise<CheckResult>
}

export interface CheckContext {
  url: string
  html: string
  title: string | null
  statusCode: number
  allPages: SiteAuditPage[]
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

export interface AuditProgress {
  status: AuditStatus
  pages_crawled: number
  checks: SiteAuditCheck[]
  overall_score: number | null
  seo_score: number | null
  ai_readiness_score: number | null
  technical_score: number | null
}
```

**Step 2: Commit**

```bash
git add lib/audit/types.ts
git commit -m "feat(audit): add TypeScript types for site audit"
```

---

## Phase 3: Crawler Service

### Task 6: Create HTML fetcher utility

**Files:**

- Create: `lib/audit/fetcher.ts`
- Create: `tests/unit/lib/audit/fetcher.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPage, extractLinks } from '@/lib/audit/fetcher'

describe('fetchPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should fetch page and return html with status code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html><head><title>Test</title></head><body></body></html>'),
    })

    const result = await fetchPage('https://example.com')

    expect(result.html).toContain('<title>Test</title>')
    expect(result.statusCode).toBe(200)
  })

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchPage('https://example.com')

    expect(result.html).toBe('')
    expect(result.statusCode).toBe(0)
    expect(result.error).toBe('Network error')
  })
})

describe('extractLinks', () => {
  it('should extract internal links from HTML', () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="https://external.com">External</a>
          <a href="https://example.com/products">Products</a>
        </body>
      </html>
    `
    const baseUrl = 'https://example.com'

    const links = extractLinks(html, baseUrl)

    expect(links).toContain('https://example.com/about')
    expect(links).toContain('https://example.com/contact')
    expect(links).toContain('https://example.com/products')
    expect(links).not.toContain('https://external.com')
  })

  it('should deduplicate links', () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="/about">About Again</a>
        </body>
      </html>
    `
    const links = extractLinks(html, 'https://example.com')

    expect(links.filter((l) => l === 'https://example.com/about')).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/lib/audit/fetcher.test.ts`
Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
import * as cheerio from 'cheerio'

export interface FetchResult {
  html: string
  statusCode: number
  error?: string
}

export async function fetchPage(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SeloBot/1.0 (Site Audit)',
      },
      redirect: 'follow',
    })

    const html = await response.text()

    return {
      html,
      statusCode: response.status,
    }
  } catch (error) {
    return {
      html: '',
      statusCode: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const links = new Set<string>()

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (!href) return

    try {
      const url = new URL(href, baseUrl)

      // Only include internal links (same hostname)
      if (url.hostname === base.hostname) {
        // Normalize: remove hash, trailing slash
        url.hash = ''
        const normalized = url.href.replace(/\/$/, '')
        links.add(normalized)
      }
    } catch {
      // Invalid URL, skip
    }
  })

  return Array.from(links)
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/lib/audit/fetcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/audit/fetcher.ts tests/unit/lib/audit/fetcher.test.ts
git commit -m "feat(audit): add HTML fetcher with link extraction"
```

---

### Task 7: Create crawler service

**Files:**

- Create: `lib/audit/crawler.ts`

**Step 1: Write crawler implementation**

```typescript
import { fetchPage, extractLinks } from './fetcher'
import type { SiteAuditPage } from './types'

export interface CrawlOptions {
  maxPages: number
  onPageCrawled?: (page: SiteAuditPage) => void
}

export interface CrawlResult {
  pages: SiteAuditPage[]
  errors: string[]
}

export async function crawlSite(
  startUrl: string,
  auditId: string,
  options: CrawlOptions
): Promise<CrawlResult> {
  const { maxPages = 200, onPageCrawled } = options
  const visited = new Set<string>()
  const queue: string[] = [normalizeUrl(startUrl)]
  const pages: SiteAuditPage[] = []
  const errors: string[] = []

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!

    if (visited.has(url)) continue
    visited.add(url)

    const { html, statusCode, error } = await fetchPage(url)

    if (error) {
      errors.push(`Failed to fetch ${url}: ${error}`)
      continue
    }

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    const page: SiteAuditPage = {
      id: crypto.randomUUID(),
      audit_id: auditId,
      url,
      title,
      status_code: statusCode,
      crawled_at: new Date().toISOString(),
    }

    pages.push(page)
    onPageCrawled?.(page)

    // Extract and queue new links
    if (statusCode === 200) {
      const links = extractLinks(html, url)
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link)
        }
      }
    }

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { pages, errors }
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href.replace(/\/$/, '')
}
```

**Step 2: Commit**

```bash
git add lib/audit/crawler.ts
git commit -m "feat(audit): add site crawler service"
```

---

## Phase 4: Check Implementations

### Task 8: Create check registry and base checks

**Files:**

- Create: `lib/audit/checks/index.ts`
- Create: `lib/audit/checks/seo/missing-meta-description.ts`
- Create: `tests/unit/lib/audit/checks/seo/missing-meta-description.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { missingMetaDescription } from '@/lib/audit/checks/seo/missing-meta-description'
import type { CheckContext } from '@/lib/audit/types'

describe('missingMetaDescription check', () => {
  it('should pass when meta description exists', async () => {
    const context: CheckContext = {
      url: 'https://example.com',
      html: '<html><head><meta name="description" content="Test description"></head></html>',
      title: 'Test',
      statusCode: 200,
      allPages: [],
    }

    const result = await missingMetaDescription.run(context)

    expect(result.status).toBe('passed')
  })

  it('should fail when meta description is missing', async () => {
    const context: CheckContext = {
      url: 'https://example.com',
      html: '<html><head><title>Test</title></head></html>',
      title: 'Test',
      statusCode: 200,
      allPages: [],
    }

    const result = await missingMetaDescription.run(context)

    expect(result.status).toBe('failed')
  })

  it('should fail when meta description is empty', async () => {
    const context: CheckContext = {
      url: 'https://example.com',
      html: '<html><head><meta name="description" content=""></head></html>',
      title: 'Test',
      statusCode: 200,
      allPages: [],
    }

    const result = await missingMetaDescription.run(context)

    expect(result.status).toBe('failed')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/lib/audit/checks/seo/missing-meta-description.test.ts`
Expected: FAIL - module not found

**Step 3: Write check implementation**

```typescript
// lib/audit/checks/seo/missing-meta-description.ts
import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingMetaDescription: AuditCheckDefinition = {
  name: 'missing_meta_description',
  type: 'seo',
  priority: 'critical',
  description: 'Pages without meta description tags',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const metaDescription = $('meta[name="description"]').attr('content')

    if (!metaDescription || metaDescription.trim() === '') {
      return {
        status: 'failed',
        details: {
          message: 'No meta description found',
        },
      }
    }

    return { status: 'passed' }
  },
}
```

**Step 4: Create check registry**

```typescript
// lib/audit/checks/index.ts
import type { AuditCheckDefinition } from '@/lib/audit/types'
import { missingMetaDescription } from './seo/missing-meta-description'

export const allChecks: AuditCheckDefinition[] = [
  missingMetaDescription,
  // More checks will be added here
]

export function getChecksByType(
  type: 'seo' | 'ai_readiness' | 'technical'
): AuditCheckDefinition[] {
  return allChecks.filter((check) => check.type === type)
}
```

**Step 5: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/lib/audit/checks/seo/missing-meta-description.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/audit/checks/ tests/unit/lib/audit/checks/
git commit -m "feat(audit): add check registry and missing meta description check"
```

---

### Task 9: Add remaining SEO checks

**Files:**

- Create: `lib/audit/checks/seo/meta-description-length.ts`
- Create: `lib/audit/checks/seo/missing-title.ts`
- Create: `lib/audit/checks/seo/title-length.ts`
- Create: `lib/audit/checks/seo/missing-h1.ts`
- Create: `lib/audit/checks/seo/multiple-h1.ts`
- Create: `lib/audit/checks/seo/heading-hierarchy.ts`
- Create: `lib/audit/checks/seo/images-missing-alt.ts`
- Create: `lib/audit/checks/seo/oversized-images.ts`
- Create: `lib/audit/checks/seo/missing-sitemap.ts`
- Create: `lib/audit/checks/seo/missing-robots-txt.ts`
- Create: `lib/audit/checks/seo/broken-links.ts`
- Create: `lib/audit/checks/seo/missing-canonical.ts`
- Create: `lib/audit/checks/seo/thin-content.ts`
- Update: `lib/audit/checks/index.ts`

**Note:** This task creates multiple check files following the same pattern as Task 8. Each check implements `AuditCheckDefinition` with a `run` method that returns `CheckResult`.

**Step 1: Create all SEO checks** (see design doc for check logic)

**Step 2: Update check registry**

```typescript
// lib/audit/checks/index.ts
import type { AuditCheckDefinition } from '@/lib/audit/types'
// SEO checks
import { missingMetaDescription } from './seo/missing-meta-description'
import { metaDescriptionLength } from './seo/meta-description-length'
import { missingTitle } from './seo/missing-title'
import { titleLength } from './seo/title-length'
import { missingH1 } from './seo/missing-h1'
import { multipleH1 } from './seo/multiple-h1'
import { headingHierarchy } from './seo/heading-hierarchy'
import { imagesMissingAlt } from './seo/images-missing-alt'
import { oversizedImages } from './seo/oversized-images'
import { missingSitemap } from './seo/missing-sitemap'
import { missingRobotsTxt } from './seo/missing-robots-txt'
import { brokenLinks } from './seo/broken-links'
import { missingCanonical } from './seo/missing-canonical'
import { thinContent } from './seo/thin-content'

export const allChecks: AuditCheckDefinition[] = [
  // SEO - Critical
  missingMetaDescription,
  missingTitle,
  missingH1,
  missingSitemap,
  missingRobotsTxt,
  brokenLinks,
  // SEO - Recommended
  metaDescriptionLength,
  titleLength,
  multipleH1,
  headingHierarchy,
  imagesMissingAlt,
  missingCanonical,
  // SEO - Optional
  oversizedImages,
  thinContent,
]
```

**Step 3: Commit**

```bash
git add lib/audit/checks/seo/
git commit -m "feat(audit): add all SEO checks"
```

---

### Task 10: Add AI-Readiness checks

**Files:**

- Create: `lib/audit/checks/ai/missing-llms-txt.ts`
- Create: `lib/audit/checks/ai/ai-crawlers-blocked.ts`
- Create: `lib/audit/checks/ai/missing-structured-data.ts`
- Create: `lib/audit/checks/ai/incomplete-structured-data.ts`
- Create: `lib/audit/checks/ai/no-faq-content.ts`
- Create: `lib/audit/checks/ai/content-not-conversational.ts`
- Create: `lib/audit/checks/ai/no-recent-updates.ts`
- Create: `lib/audit/checks/ai/missing-markdown-alternatives.ts`
- Update: `lib/audit/checks/index.ts`

**Step 1: Create AI-readiness checks**

Example: `lib/audit/checks/ai/missing-llms-txt.ts`

```typescript
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingLlmsTxt: AuditCheckDefinition = {
  name: 'missing_llms_txt',
  type: 'ai_readiness',
  priority: 'critical',
  description: 'No /llms.txt file for LLM crawlers',

  async run(context: CheckContext): Promise<CheckResult> {
    // This is a site-wide check - only run on homepage
    if (context.url !== new URL(context.url).origin) {
      return { status: 'passed' } // Skip for non-homepage
    }

    try {
      const llmsTxtUrl = new URL('/llms.txt', context.url).href
      const response = await fetch(llmsTxtUrl, { method: 'HEAD' })

      if (response.ok) {
        return { status: 'passed' }
      }

      return {
        status: 'failed',
        details: {
          message: 'No llms.txt file found at /llms.txt',
          recommendation: 'Create an llms.txt file to help AI crawlers understand your site',
        },
      }
    } catch {
      return {
        status: 'failed',
        details: { message: 'Could not check for llms.txt' },
      }
    }
  },
}
```

**Step 2: Update check registry with AI checks**

**Step 3: Commit**

```bash
git add lib/audit/checks/ai/
git commit -m "feat(audit): add AI-readiness checks"
```

---

### Task 11: Add Technical checks

**Files:**

- Create: `lib/audit/checks/technical/slow-page-load.ts`
- Create: `lib/audit/checks/technical/not-mobile-friendly.ts`
- Create: `lib/audit/checks/technical/missing-ssl.ts`
- Create: `lib/audit/checks/technical/mixed-content.ts`
- Create: `lib/audit/checks/technical/missing-og-tags.ts`
- Create: `lib/audit/checks/technical/missing-favicon.ts`
- Update: `lib/audit/checks/index.ts`

**Step 1: Create technical checks**

**Step 2: Update check registry with all checks**

**Step 3: Commit**

```bash
git add lib/audit/checks/technical/
git commit -m "feat(audit): add technical checks"
```

---

## Phase 5: Audit Runner Service

### Task 12: Create audit runner

**Files:**

- Create: `lib/audit/runner.ts`

**Step 1: Write audit runner**

```typescript
import { createClient } from '@/lib/supabase/server'
import { crawlSite } from './crawler'
import { allChecks } from './checks'
import { fetchPage } from './fetcher'
import type { SiteAudit, SiteAuditPage, SiteAuditCheck, CheckContext } from './types'

export async function runAudit(auditId: string, url: string): Promise<void> {
  const supabase = await createClient()

  // Update status to crawling
  await supabase
    .from('site_audits')
    .update({ status: 'crawling', started_at: new Date().toISOString() })
    .eq('id', auditId)

  try {
    // Crawl the site
    const { pages, errors } = await crawlSite(url, auditId, {
      maxPages: 200,
      onPageCrawled: async (page) => {
        // Save page to database
        await supabase.from('site_audit_pages').insert(page)

        // Update pages_crawled count
        await supabase.from('site_audits').update({ pages_crawled: pages.length }).eq('id', auditId)
      },
    })

    // Run checks on each page
    const allCheckResults: SiteAuditCheck[] = []

    for (const page of pages) {
      const { html } = await fetchPage(page.url)

      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title,
        statusCode: page.status_code ?? 200,
        allPages: pages,
      }

      for (const check of allChecks) {
        const result = await check.run(context)

        const checkResult: SiteAuditCheck = {
          id: crypto.randomUUID(),
          audit_id: auditId,
          page_id: page.id,
          check_type: check.type,
          check_name: check.name,
          priority: check.priority,
          status: result.status,
          details: result.details ?? null,
          created_at: new Date().toISOString(),
        }

        allCheckResults.push(checkResult)
        await supabase.from('site_audit_checks').insert(checkResult)
      }
    }

    // Calculate scores
    const scores = calculateScores(allCheckResults)

    // Update audit with scores
    await supabase
      .from('site_audits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...scores,
      })
      .eq('id', auditId)
  } catch (error) {
    await supabase
      .from('site_audits')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}

function calculateScores(checks: SiteAuditCheck[]) {
  const scoreByType = (type: string) => {
    const typeChecks = checks.filter((c) => c.check_type === type)
    if (typeChecks.length === 0) return 100

    const weights = { critical: 3, recommended: 2, optional: 1 }
    let totalWeight = 0
    let earnedWeight = 0

    for (const check of typeChecks) {
      const weight = weights[check.priority]
      totalWeight += weight
      if (check.status === 'passed') {
        earnedWeight += weight
      } else if (check.status === 'warning') {
        earnedWeight += weight * 0.5
      }
    }

    return Math.round((earnedWeight / totalWeight) * 100)
  }

  const seo_score = scoreByType('seo')
  const ai_readiness_score = scoreByType('ai_readiness')
  const technical_score = scoreByType('technical')
  const overall_score = Math.round((seo_score + ai_readiness_score + technical_score) / 3)

  return { overall_score, seo_score, ai_readiness_score, technical_score }
}
```

**Step 2: Commit**

```bash
git add lib/audit/runner.ts
git commit -m "feat(audit): add audit runner with score calculation"
```

---

## Phase 6: API Routes

### Task 13: Create start audit API route

**Files:**

- Create: `app/api/audit/start/route.ts`

**Step 1: Write API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/runner'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get organization's website URL
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  if (!org?.website_url) {
    return NextResponse.json({ error: 'No website URL configured' }, { status: 400 })
  }

  // Create audit record
  const { data: audit, error } = await supabase
    .from('site_audits')
    .insert({
      organization_id: userRecord.organization_id,
      url: org.website_url,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start crawl in background (don't await)
  runAudit(audit.id, org.website_url).catch(console.error)

  return NextResponse.json({ auditId: audit.id })
}
```

**Step 2: Commit**

```bash
git add app/api/audit/start/route.ts
git commit -m "feat(audit): add start audit API route"
```

---

### Task 14: Create audit status API route

**Files:**

- Create: `app/api/audit/[id]/status/route.ts`

**Step 1: Write API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: audit } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Get recent checks
  const { data: checks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    status: audit.status,
    pages_crawled: audit.pages_crawled,
    overall_score: audit.overall_score,
    seo_score: audit.seo_score,
    ai_readiness_score: audit.ai_readiness_score,
    technical_score: audit.technical_score,
    checks: checks ?? [],
  })
}
```

**Step 2: Commit**

```bash
git add app/api/audit/[id]/status/route.ts
git commit -m "feat(audit): add audit status API route"
```

---

### Task 15: Create audit results API route

**Files:**

- Create: `app/api/audit/[id]/route.ts`

**Step 1: Write API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: audit } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const { data: pages } = await supabase
    .from('site_audit_pages')
    .select('*')
    .eq('audit_id', params.id)

  const { data: checks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', params.id)

  return NextResponse.json({
    audit,
    pages: pages ?? [],
    checks: checks ?? [],
  })
}
```

**Step 2: Commit**

```bash
git add app/api/audit/[id]/route.ts
git commit -m "feat(audit): add audit results API route"
```

---

## Phase 7: AI Executive Summary

### Task 16: Add executive summary generation

**Files:**

- Create: `lib/audit/summary.ts`
- Modify: `lib/audit/runner.ts`

**Step 1: Create summary generator**

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { SiteAuditCheck } from './types'

export async function generateExecutiveSummary(
  url: string,
  pagesCrawled: number,
  scores: {
    overall_score: number
    seo_score: number
    ai_readiness_score: number
    technical_score: number
  },
  checks: SiteAuditCheck[]
): Promise<string> {
  const criticalFails = checks.filter((c) => c.priority === 'critical' && c.status === 'failed')
  const recommendedFails = checks.filter(
    (c) => c.priority === 'recommended' && c.status === 'failed'
  )

  const prompt = `You are writing an executive summary for a website audit report.

Site: ${url}
Pages crawled: ${pagesCrawled}
Overall Score: ${scores.overall_score}/100

Results:
- SEO: ${scores.seo_score}/100 - ${criticalFails.filter((c) => c.check_type === 'seo').length} critical issues
- AI-Readiness: ${scores.ai_readiness_score}/100 - ${criticalFails.filter((c) => c.check_type === 'ai_readiness').length} critical issues
- Technical: ${scores.technical_score}/100 - ${criticalFails.filter((c) => c.check_type === 'technical').length} critical issues

Top critical issues: ${criticalFails
    .slice(0, 5)
    .map((c) => c.check_name.replace(/_/g, ' '))
    .join(', ')}

Write a 2-3 paragraph executive summary that:
1. Summarizes the overall health of the site
2. Highlights the most impactful issues to fix
3. Ends with an encouraging next step

Keep it non-technical and suitable for a business owner. Do not use markdown formatting.`

  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    prompt,
  })

  return text
}
```

**Step 2: Update runner to generate summary**

Add after score calculation in `runner.ts`:

```typescript
// Generate executive summary
const summary = await generateExecutiveSummary(url, pages.length, scores, allCheckResults)

// Update audit with scores and summary
await supabase
  .from('site_audits')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    executive_summary: summary,
    ...scores,
  })
  .eq('id', auditId)
```

**Step 3: Commit**

```bash
git add lib/audit/summary.ts lib/audit/runner.ts
git commit -m "feat(audit): add AI executive summary generation"
```

---

## Phase 8: UI Components

### Task 17: Add sidebar menu item

**Files:**

- Modify: `components/layout/sidebar.tsx` (or equivalent navigation component)

**Step 1: Find and update sidebar navigation**

Add "SEO / AIO Audit" menu item, disabled when no website_url is configured.

**Step 2: Commit**

```bash
git add components/layout/
git commit -m "feat(audit): add sidebar menu item"
```

---

### Task 18: Create audit list page

**Files:**

- Create: `app/audit/page.tsx`
- Create: `app/audit/actions.ts`

**Step 1: Create server actions**

```typescript
// app/audit/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getAuditData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  const { data: audits } = await supabase
    .from('site_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const { data: archivedAudits } = await supabase
    .from('site_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false })

  return {
    websiteUrl: org?.website_url ?? null,
    audits: audits ?? [],
    archivedAudits: archivedAudits ?? [],
  }
}

export async function startNewAudit() {
  const response = await fetch('/api/audit/start', { method: 'POST' })
  const data = await response.json()
  return data.auditId
}
```

**Step 2: Create page component**

```typescript
// app/audit/page.tsx
import { getAuditData } from './actions'
import { AuditDashboard } from '@/components/audit/audit-dashboard'
import { NoUrlConfigured } from '@/components/audit/no-url-configured'

export default async function AuditPage() {
  const { websiteUrl, audits, archivedAudits } = await getAuditData()

  if (!websiteUrl) {
    return <NoUrlConfigured />
  }

  return (
    <AuditDashboard
      websiteUrl={websiteUrl}
      audits={audits}
      archivedAudits={archivedAudits}
    />
  )
}
```

**Step 3: Commit**

```bash
git add app/audit/
git commit -m "feat(audit): add audit list page"
```

---

### Task 19: Create audit dashboard component

**Files:**

- Create: `components/audit/audit-dashboard.tsx`
- Create: `components/audit/score-trend-chart.tsx`
- Create: `components/audit/audit-history-list.tsx`
- Create: `components/audit/no-url-configured.tsx`

**Step 1: Create components**

(See design doc for UI specifications)

**Step 2: Commit**

```bash
git add components/audit/
git commit -m "feat(audit): add audit dashboard components"
```

---

### Task 20: Create audit report page

**Files:**

- Create: `app/audit/[id]/page.tsx`
- Create: `components/audit/audit-report.tsx`
- Create: `components/audit/score-cards.tsx`
- Create: `components/audit/check-list.tsx`
- Create: `components/audit/check-item.tsx`

**Step 1: Create report page and components**

(See design doc for UI specifications)

**Step 2: Commit**

```bash
git add app/audit/[id]/ components/audit/
git commit -m "feat(audit): add audit report page and components"
```

---

### Task 21: Create live audit progress view

**Files:**

- Create: `components/audit/live-progress.tsx`
- Create: `hooks/use-audit-polling.ts`

**Step 1: Create polling hook**

```typescript
// hooks/use-audit-polling.ts
import { useState, useEffect } from 'react'
import type { AuditProgress } from '@/lib/audit/types'

export function useAuditPolling(auditId: string, enabled: boolean) {
  const [progress, setProgress] = useState<AuditProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return

    const poll = async () => {
      const response = await fetch(`/api/audit/${auditId}/status`)
      const data = await response.json()
      setProgress(data)
      setIsLoading(false)

      if (data.status === 'pending' || data.status === 'crawling') {
        setTimeout(poll, 2000)
      }
    }

    poll()
  }, [auditId, enabled])

  return { progress, isLoading }
}
```

**Step 2: Create progress component**

**Step 3: Commit**

```bash
git add components/audit/live-progress.tsx hooks/use-audit-polling.ts
git commit -m "feat(audit): add live progress polling"
```

---

## Phase 9: PDF Export

### Task 22: Create PDF export

**Files:**

- Create: `lib/audit/pdf.tsx`
- Create: `app/api/audit/[id]/export/route.ts`

**Step 1: Install dependency**

Run: `npm install @react-pdf/renderer`

**Step 2: Create PDF template**

```typescript
// lib/audit/pdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { SiteAudit, SiteAuditCheck } from './types'

const styles = StyleSheet.create({
  page: { padding: 40 },
  title: { fontSize: 24, marginBottom: 20 },
  // ... more styles
})

interface AuditPDFProps {
  audit: SiteAudit
  checks: SiteAuditCheck[]
}

export function AuditPDF({ audit, checks }: AuditPDFProps) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Website Audit Report</Text>
        <Text>{audit.url}</Text>
        <Text>{new Date(audit.created_at).toLocaleDateString()}</Text>
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Executive Summary</Text>
        <Text>{audit.executive_summary}</Text>
        {/* Score cards */}
      </Page>

      {/* Detailed Findings */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Detailed Findings</Text>
        {/* Check results */}
      </Page>
    </Document>
  )
}
```

**Step 3: Create export API route**

```typescript
// app/api/audit/[id]/export/route.ts
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { AuditPDF } from '@/lib/audit/pdf'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  // ... auth and data fetching

  const pdfBuffer = await renderToBuffer(<AuditPDF audit={audit} checks={checks} />)

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-${audit.url.replace(/[^a-z0-9]/gi, '-')}.pdf"`,
    },
  })
}
```

**Step 4: Commit**

```bash
git add lib/audit/pdf.tsx app/api/audit/[id]/export/
git commit -m "feat(audit): add PDF export"
```

---

## Phase 10: URL Change Handling

### Task 23: Add URL change confirmation dialog

**Files:**

- Modify: `app/settings/organization/page.tsx` (or form component)
- Create: `components/audit/url-change-dialog.tsx`

**Step 1: Create confirmation dialog component**

**Step 2: Add logic to archive audits when URL changes**

**Step 3: Commit**

```bash
git add components/audit/url-change-dialog.tsx app/settings/
git commit -m "feat(audit): add URL change confirmation with archiving"
```

---

## Phase 11: Empty State & Toast

### Task 24: Add website URL toast notification

**Files:**

- Modify: `app/dashboard/page.tsx` or layout component
- Create: `components/audit/website-url-toast.tsx`

**Step 1: Create toast component that shows when website_url is null**

**Step 2: Commit**

```bash
git add components/audit/website-url-toast.tsx
git commit -m "feat(audit): add website URL configuration toast"
```

---

## Phase 12: Testing & Cleanup

### Task 25: Add integration tests

**Files:**

- Create: `tests/integration/audit.test.ts`

**Step 1: Write integration tests for audit flow**

**Step 2: Run tests**

Run: `npm run test:integration`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/audit.test.ts
git commit -m "test(audit): add integration tests"
```

---

### Task 26: Final review and cleanup

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit if any cleanup needed**

---

## Summary

| Phase | Tasks | Description                       |
| ----- | ----- | --------------------------------- |
| 1     | 1-4   | Database schema (4 migrations)    |
| 2     | 5     | TypeScript types                  |
| 3     | 6-7   | Crawler service                   |
| 4     | 8-11  | Check implementations (28 checks) |
| 5     | 12    | Audit runner                      |
| 6     | 13-15 | API routes                        |
| 7     | 16    | AI executive summary              |
| 8     | 17-21 | UI components                     |
| 9     | 22    | PDF export                        |
| 10    | 23    | URL change handling               |
| 11    | 24    | Empty state & toast               |
| 12    | 25-26 | Testing & cleanup                 |

**Total: 26 tasks**
