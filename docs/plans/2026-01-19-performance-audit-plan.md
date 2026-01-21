# Performance Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Performance Audit feature using PageSpeed Insights API to measure Core Web Vitals and Lighthouse scores, with weekly automated audits.

**Architecture:** New `performance_audits` and `performance_audit_results` tables store audit runs. PageSpeed Insights API client fetches metrics. UI integrates into existing Audit section as a tab. Vercel Cron triggers weekly automated audits for monitored sites.

**Tech Stack:** Next.js API routes, Supabase PostgreSQL, Google PageSpeed Insights API, Recharts for trend visualization, Vercel Cron for scheduling.

---

## Phase 1: Database & Types

### Task 1: Create Performance Audit Database Tables

**Files:**

- Create: `supabase/migrations/20260119100001_create_performance_audits.sql`

**Step 1: Write the migration file**

```sql
-- Create performance_audits table (audit runs)
CREATE TABLE performance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create performance_audit_results table (per-page results)
CREATE TABLE performance_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES performance_audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  device text NOT NULL CHECK (device IN ('mobile', 'desktop')),

  -- Core Web Vitals (from CrUX field data when available)
  lcp_ms integer,
  lcp_rating text CHECK (lcp_rating IS NULL OR lcp_rating IN ('good', 'needs_improvement', 'poor')),
  inp_ms integer,
  inp_rating text CHECK (inp_rating IS NULL OR inp_rating IN ('good', 'needs_improvement', 'poor')),
  cls_score numeric(5,3),
  cls_rating text CHECK (cls_rating IS NULL OR cls_rating IN ('good', 'needs_improvement', 'poor')),

  -- Lighthouse scores (0-100)
  performance_score integer,
  accessibility_score integer,
  best_practices_score integer,
  seo_score integer,

  -- Raw API response for diagnostics
  raw_response jsonb,

  created_at timestamptz DEFAULT now()
);

-- Create monitored_pages table (pages to track regularly)
CREATE TABLE monitored_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, url)
);

-- Create monitored_sites table (sites for weekly auto-audit)
CREATE TABLE monitored_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  run_site_audit boolean DEFAULT true,
  run_performance_audit boolean DEFAULT true,
  last_site_audit_at timestamptz,
  last_performance_audit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, url)
);

-- Indexes
CREATE INDEX idx_performance_audits_org ON performance_audits(organization_id);
CREATE INDEX idx_performance_audit_results_audit ON performance_audit_results(audit_id);
CREATE INDEX idx_monitored_pages_org ON monitored_pages(organization_id);
CREATE INDEX idx_monitored_sites_org ON monitored_sites(organization_id);

-- RLS policies for performance_audits
ALTER TABLE performance_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's performance audits"
ON performance_audits FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert performance audits for their organization"
ON performance_audits FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their organization's performance audits"
ON performance_audits FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- RLS policies for performance_audit_results
ALTER TABLE performance_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's performance results"
ON performance_audit_results FOR SELECT
USING (audit_id IN (
  SELECT id FROM performance_audits
  WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
));

CREATE POLICY "Users can insert performance results for their audits"
ON performance_audit_results FOR INSERT
WITH CHECK (audit_id IN (
  SELECT id FROM performance_audits
  WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
));

-- RLS policies for monitored_pages
ALTER TABLE monitored_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's monitored pages"
ON monitored_pages FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their organization's monitored pages"
ON monitored_pages FOR ALL
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- RLS policies for monitored_sites
ALTER TABLE monitored_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's monitored sites"
ON monitored_sites FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their organization's monitored sites"
ON monitored_sites FOR ALL
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
```

**Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: Migration applies successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260119100001_create_performance_audits.sql
git commit -m "feat(db): add performance audit tables and RLS policies"
```

---

### Task 2: Create TypeScript Types

**Files:**

- Create: `lib/performance/types.ts`

**Step 1: Write the types file**

```typescript
export type PerformanceAuditStatus = 'pending' | 'running' | 'completed' | 'failed'

export type CWVRating = 'good' | 'needs_improvement' | 'poor'

export type DeviceType = 'mobile' | 'desktop'

export interface PerformanceAudit {
  id: string
  organization_id: string
  created_by: string | null
  status: PerformanceAuditStatus
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface PerformanceAuditResult {
  id: string
  audit_id: string
  url: string
  device: DeviceType
  // Core Web Vitals
  lcp_ms: number | null
  lcp_rating: CWVRating | null
  inp_ms: number | null
  inp_rating: CWVRating | null
  cls_score: number | null
  cls_rating: CWVRating | null
  // Lighthouse scores
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  // Raw response
  raw_response: Record<string, unknown> | null
  created_at: string
}

export interface MonitoredPage {
  id: string
  organization_id: string
  url: string
  added_by: string | null
  created_at: string
}

export interface MonitoredSite {
  id: string
  organization_id: string
  url: string
  run_site_audit: boolean
  run_performance_audit: boolean
  last_site_audit_at: string | null
  last_performance_audit_at: string | null
  created_at: string
}

// PageSpeed Insights API types
export interface PageSpeedResult {
  lighthouseResult: {
    categories: {
      performance?: { score: number }
      accessibility?: { score: number }
      'best-practices'?: { score: number }
      seo?: { score: number }
    }
    audits: Record<string, unknown>
  }
  loadingExperience?: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS?: {
        percentile: number
        category: string
      }
      INTERACTION_TO_NEXT_PAINT?: {
        percentile: number
        category: string
      }
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: {
        percentile: number
        category: string
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add lib/performance/types.ts
git commit -m "feat(types): add performance audit TypeScript types"
```

---

## Phase 2: PageSpeed Insights API Integration

### Task 3: Create PageSpeed Insights API Client

**Files:**

- Create: `lib/performance/api.ts`

**Step 1: Write the API client**

```typescript
import type { PageSpeedResult, CWVRating, DeviceType } from './types'

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

interface FetchPageSpeedOptions {
  url: string
  device: DeviceType
}

export async function fetchPageSpeedInsights({
  url,
  device,
}: FetchPageSpeedOptions): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY
  if (!apiKey) {
    throw new Error('PAGESPEED_API_KEY environment variable is not set')
  }

  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy: device,
    category: 'performance',
    category: 'accessibility',
    category: 'best-practices',
    category: 'seo',
  })

  // URLSearchParams doesn't handle multiple same-name params well, rebuild
  const categoryParams = ['performance', 'accessibility', 'best-practices', 'seo']
    .map((c) => `category=${c}`)
    .join('&')

  const fullUrl = `${PAGESPEED_API_URL}?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=${device}&${categoryParams}`

  const response = await fetch(fullUrl, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PageSpeed API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

export function mapCategoryToRating(category: string | undefined): CWVRating | null {
  if (!category) return null
  const mapping: Record<string, CWVRating> = {
    FAST: 'good',
    AVERAGE: 'needs_improvement',
    SLOW: 'poor',
  }
  return mapping[category] || null
}

export function extractMetrics(result: PageSpeedResult) {
  const lighthouse = result.lighthouseResult
  const fieldData = result.loadingExperience?.metrics

  return {
    // Lighthouse scores (convert 0-1 to 0-100)
    performance_score: lighthouse.categories.performance?.score
      ? Math.round(lighthouse.categories.performance.score * 100)
      : null,
    accessibility_score: lighthouse.categories.accessibility?.score
      ? Math.round(lighthouse.categories.accessibility.score * 100)
      : null,
    best_practices_score: lighthouse.categories['best-practices']?.score
      ? Math.round(lighthouse.categories['best-practices'].score * 100)
      : null,
    seo_score: lighthouse.categories.seo?.score
      ? Math.round(lighthouse.categories.seo.score * 100)
      : null,

    // Core Web Vitals from field data (CrUX)
    lcp_ms: fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    lcp_rating: mapCategoryToRating(fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.category),
    inp_ms: fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    inp_rating: mapCategoryToRating(fieldData?.INTERACTION_TO_NEXT_PAINT?.category),
    cls_score: fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
      ? fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
      : null,
    cls_rating: mapCategoryToRating(fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category),
  }
}
```

**Step 2: Add environment variable to .env.local.example**

Add to `.env.local.example`:

```
PAGESPEED_API_KEY=your_pagespeed_api_key_here
```

**Step 3: Commit**

```bash
git add lib/performance/api.ts
git commit -m "feat(api): add PageSpeed Insights API client"
```

---

### Task 4: Create Performance Audit Runner

**Files:**

- Create: `lib/performance/runner.ts`

**Step 1: Write the runner**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { fetchPageSpeedInsights, extractMetrics } from './api'
import type { DeviceType, PerformanceAuditStatus } from './types'

export async function runPerformanceAudit(auditId: string, urls: string[]): Promise<void> {
  const supabase = createServiceClient()

  // Update status to running
  await supabase
    .from('performance_audits')
    .update({
      status: 'running' as PerformanceAuditStatus,
      started_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  try {
    const devices: DeviceType[] = ['mobile', 'desktop']

    for (const url of urls) {
      for (const device of devices) {
        try {
          console.log(`[Performance] Auditing ${url} (${device})`)

          const result = await fetchPageSpeedInsights({ url, device })
          const metrics = extractMetrics(result)

          await supabase.from('performance_audit_results').insert({
            audit_id: auditId,
            url,
            device,
            ...metrics,
            raw_response: result,
          })

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`[Performance] Failed to audit ${url} (${device}):`, error)
          // Continue with other URLs even if one fails
        }
      }
    }

    // Mark as completed
    await supabase
      .from('performance_audits')
      .update({
        status: 'completed' as PerformanceAuditStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Performance Runner Error]', { auditId, error: errorMessage })

    await supabase
      .from('performance_audits')
      .update({
        status: 'failed' as PerformanceAuditStatus,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}
```

**Step 2: Commit**

```bash
git add lib/performance/runner.ts
git commit -m "feat(runner): add performance audit runner"
```

---

## Phase 3: API Routes

### Task 5: Create Start Performance Audit Endpoint

**Files:**

- Create: `app/api/performance/start/route.ts`

**Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPerformanceAudit } from '@/lib/performance/runner'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get request body
  const body = await request.json().catch(() => ({}))
  const { urls } = body as { urls?: string[] }

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'URLs are required' }, { status: 400 })
  }

  // Validate URLs
  for (const url of urls) {
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: `Invalid URL: ${url}` }, { status: 400 })
    }
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

  // Create audit record
  const { data: audit, error } = await supabase
    .from('performance_audits')
    .insert({
      organization_id: userRecord.organization_id,
      created_by: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Performance API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start audit in background
  runPerformanceAudit(audit.id, urls).catch((err) => {
    console.error('[Performance API] Background audit failed:', err)
  })

  return NextResponse.json({ auditId: audit.id })
}
```

**Step 2: Commit**

```bash
git add app/api/performance/start/route.ts
git commit -m "feat(api): add POST /api/performance/start endpoint"
```

---

### Task 6: Create Get Performance Audit Endpoint

**Files:**

- Create: `app/api/performance/[id]/route.ts`

**Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get audit with results
  const { data: audit, error: auditError } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (auditError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Get results
  const { data: results } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)
    .order('url')
    .order('device')

  return NextResponse.json({
    audit,
    results: results || [],
  })
}
```

**Step 2: Commit**

```bash
git add app/api/performance/[id]/route.ts
git commit -m "feat(api): add GET /api/performance/[id] endpoint"
```

---

### Task 7: Create Monitored Pages Endpoints

**Files:**

- Create: `app/api/performance/pages/route.ts`

**Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List monitored pages
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: pages } = await supabase
    .from('monitored_pages')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  return NextResponse.json(pages || [])
}

// POST - Add monitored page
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { url } = body as { url?: string }

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: page, error } = await supabase
    .from('monitored_pages')
    .insert({
      organization_id: userRecord.organization_id,
      url,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Page already monitored' }, { status: 409 })
    }
    console.error('[Monitored Pages] Insert error:', error)
    return NextResponse.json({ error: 'Failed to add page' }, { status: 500 })
  }

  return NextResponse.json(page)
}

// DELETE - Remove monitored page
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Page ID is required' }, { status: 400 })
  }

  const { error } = await supabase.from('monitored_pages').delete().eq('id', id)

  if (error) {
    console.error('[Monitored Pages] Delete error:', error)
    return NextResponse.json({ error: 'Failed to remove page' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add app/api/performance/pages/route.ts
git commit -m "feat(api): add monitored pages CRUD endpoints"
```

---

## Phase 4: UI Components

### Task 8: Create Performance Score Card Component

**Files:**

- Create: `components/performance/score-gauge.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number | null
  label: string
  size?: 'sm' | 'md' | 'lg'
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 90) return 'text-green-600'
  if (score >= 50) return 'text-orange-500'
  return 'text-red-600'
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'stroke-muted'
  if (score >= 90) return 'stroke-green-600'
  if (score >= 50) return 'stroke-orange-500'
  return 'stroke-red-600'
}

export function ScoreGauge({ score, label, size = 'md' }: ScoreGaugeProps) {
  const sizeClasses = {
    sm: 'size-16',
    md: 'size-24',
    lg: 'size-32',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8
  const radius = size === 'sm' ? 28 : size === 'md' ? 42 : 56
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? (score / 100) * circumference : 0

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative', sizeClasses[size])}>
        <svg className="size-full -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className={cn('transition-all duration-500', getScoreBgColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold tabular-nums', textSizeClasses[size], getScoreColor(score))}>
            {score !== null ? score : '—'}
          </span>
        </div>
      </div>
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/performance/score-gauge.tsx
git commit -m "feat(ui): add ScoreGauge component for performance scores"
```

---

### Task 9: Create Core Web Vitals Component

**Files:**

- Create: `components/performance/core-web-vitals.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { cn } from '@/lib/utils'
import type { CWVRating } from '@/lib/performance/types'

interface CoreWebVitalsProps {
  lcp: { value: number | null; rating: CWVRating | null }
  inp: { value: number | null; rating: CWVRating | null }
  cls: { value: number | null; rating: CWVRating | null }
}

function getRatingColor(rating: CWVRating | null): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'needs_improvement':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'poor':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-muted text-muted-foreground border-muted'
  }
}

function getRatingLabel(rating: CWVRating | null): string {
  switch (rating) {
    case 'good':
      return 'Good'
    case 'needs_improvement':
      return 'Needs Improvement'
    case 'poor':
      return 'Poor'
    default:
      return 'No Data'
  }
}

interface MetricCardProps {
  name: string
  value: string
  target: string
  rating: CWVRating | null
}

function MetricCard({ name, value, target, rating }: MetricCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', getRatingColor(rating))}>
      <div className="mb-1 text-sm font-medium opacity-80">{name}</div>
      <div className="mb-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-70">Target: {target}</span>
        <span className="font-medium">{getRatingLabel(rating)}</span>
      </div>
    </div>
  )
}

export function CoreWebVitals({ lcp, inp, cls }: CoreWebVitalsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        name="LCP"
        value={lcp.value !== null ? `${(lcp.value / 1000).toFixed(1)}s` : '—'}
        target="< 2.5s"
        rating={lcp.rating}
      />
      <MetricCard
        name="INP"
        value={inp.value !== null ? `${inp.value}ms` : '—'}
        target="< 200ms"
        rating={inp.rating}
      />
      <MetricCard
        name="CLS"
        value={cls.value !== null ? cls.value.toFixed(3) : '—'}
        target="< 0.1"
        rating={cls.rating}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/performance/core-web-vitals.tsx
git commit -m "feat(ui): add CoreWebVitals component"
```

---

### Task 10: Create Performance Results Component

**Files:**

- Create: `components/performance/performance-results.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreGauge } from './score-gauge'
import { CoreWebVitals } from './core-web-vitals'
import type { PerformanceAuditResult, DeviceType } from '@/lib/performance/types'
import { Smartphone, Monitor } from 'lucide-react'

interface PerformanceResultsProps {
  results: PerformanceAuditResult[]
}

export function PerformanceResults({ results }: PerformanceResultsProps) {
  const [device, setDevice] = useState<DeviceType>('mobile')

  // Group results by URL
  const resultsByUrl = results.reduce(
    (acc, result) => {
      if (!acc[result.url]) {
        acc[result.url] = { mobile: null, desktop: null }
      }
      acc[result.url][result.device] = result
      return acc
    },
    {} as Record<string, { mobile: PerformanceAuditResult | null; desktop: PerformanceAuditResult | null }>
  )

  const urls = Object.keys(resultsByUrl)

  if (urls.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No results yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Device Toggle */}
      <Tabs value={device} onValueChange={(v) => setDevice(v as DeviceType)}>
        <TabsList>
          <TabsTrigger value="mobile" className="gap-2">
            <Smartphone className="size-4" />
            Mobile
          </TabsTrigger>
          <TabsTrigger value="desktop" className="gap-2">
            <Monitor className="size-4" />
            Desktop
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results by URL */}
      {urls.map((url) => {
        const result = resultsByUrl[url][device]
        if (!result) return null

        return (
          <Card key={url}>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {new URL(url).pathname || '/'}
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lighthouse Scores */}
              <div>
                <h4 className="text-muted-foreground mb-4 text-sm font-medium">Lighthouse Scores</h4>
                <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
                  <ScoreGauge score={result.performance_score} label="Performance" />
                  <ScoreGauge score={result.accessibility_score} label="Accessibility" />
                  <ScoreGauge score={result.best_practices_score} label="Best Practices" />
                  <ScoreGauge score={result.seo_score} label="SEO" />
                </div>
              </div>

              {/* Core Web Vitals */}
              <div>
                <h4 className="text-muted-foreground mb-4 text-sm font-medium">
                  Core Web Vitals (Field Data)
                </h4>
                <CoreWebVitals
                  lcp={{ value: result.lcp_ms, rating: result.lcp_rating }}
                  inp={{ value: result.inp_ms, rating: result.inp_rating }}
                  cls={{ value: result.cls_score, rating: result.cls_rating }}
                />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/performance/performance-results.tsx
git commit -m "feat(ui): add PerformanceResults component"
```

---

## Phase 5: Pages & Integration

### Task 11: Create Performance Audit Page

**Files:**

- Create: `app/audit/performance/page.tsx`
- Create: `app/audit/performance/actions.ts`

**Step 1: Write the actions file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'

export async function getPerformanceData(): Promise<{
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  websiteUrl: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { audits: [], monitoredPages: [], websiteUrl: null }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { audits: [], monitoredPages: [], websiteUrl: null }
  }

  // Get organization website URL
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Get audits
  const { data: audits } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get monitored pages
  const { data: monitoredPages } = await supabase
    .from('monitored_pages')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  return {
    audits: audits || [],
    monitoredPages: monitoredPages || [],
    websiteUrl: org?.website_url || null,
  }
}
```

**Step 2: Write the page component**

```typescript
import { getPerformanceData } from './actions'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { NoUrlConfigured } from '@/components/audit/no-url-configured'

export default async function PerformanceAuditPage() {
  const { audits, monitoredPages, websiteUrl } = await getPerformanceData()

  if (!websiteUrl) {
    return <NoUrlConfigured />
  }

  return (
    <PerformanceDashboard
      audits={audits}
      monitoredPages={monitoredPages}
      websiteUrl={websiteUrl}
    />
  )
}
```

**Step 3: Commit**

```bash
git add app/audit/performance/page.tsx app/audit/performance/actions.ts
git commit -m "feat(pages): add performance audit page and actions"
```

---

### Task 12: Create Performance Dashboard Component

**Files:**

- Create: `components/performance/performance-dashboard.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'
import { formatDate } from '@/lib/utils'

interface PerformanceDashboardProps {
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  websiteUrl: string
}

export function PerformanceDashboard({
  audits,
  monitoredPages: initialPages,
  websiteUrl,
}: PerformanceDashboardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [monitoredPages, setMonitoredPages] = useState(initialPages)
  const [newUrl, setNewUrl] = useState('')

  const handleRunAudit = () => {
    setError(null)

    // Collect URLs: homepage + monitored pages
    const urls = [websiteUrl, ...monitoredPages.map((p) => p.url)]
    const uniqueUrls = [...new Set(urls)]

    startTransition(async () => {
      try {
        const response = await fetch('/api/performance/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: uniqueUrls }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to start audit')
          return
        }

        const data = await response.json()
        router.push(`/audit/performance/${data.auditId}`)
      } catch (err) {
        console.error('[Performance Dashboard] Failed to start audit:', err)
        setError('Failed to start audit')
      }
    })
  }

  const handleAddPage = async () => {
    if (!newUrl.trim()) return

    try {
      const response = await fetch('/api/performance/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to add page')
        return
      }

      const page = await response.json()
      setMonitoredPages((prev) => [page, ...prev])
      setNewUrl('')
    } catch (err) {
      console.error('[Performance Dashboard] Failed to add page:', err)
      setError('Failed to add page')
    }
  }

  const handleRemovePage = async (id: string) => {
    try {
      await fetch(`/api/performance/pages?id=${id}`, { method: 'DELETE' })
      setMonitoredPages((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('[Performance Dashboard] Failed to remove page:', err)
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-balance">Performance Audit</h1>
      </div>

      {/* Run Audit Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Run Performance Audit</CardTitle>
              <CardDescription>
                Test {1 + monitoredPages.length} page{monitoredPages.length !== 0 ? 's' : ''} with
                PageSpeed Insights
              </CardDescription>
            </div>
            <Button onClick={handleRunAudit} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Run Audit'
              )}
            </Button>
          </div>
          {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
        </CardHeader>
      </Card>

      {/* Monitored Pages */}
      <Card>
        <CardHeader>
          <CardTitle>Monitored Pages</CardTitle>
          <CardDescription>
            Pages to include in performance audits. Homepage is always included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new page */}
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/page"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPage()}
            />
            <Button onClick={handleAddPage} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Homepage (always included) */}
          <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-sm">{websiteUrl}</span>
            <span className="text-muted-foreground text-xs">Homepage (always included)</span>
          </div>

          {/* Monitored pages list */}
          {monitoredPages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="truncate text-sm">{page.url}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePage(page.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No audits yet. Run your first performance audit above.
            </p>
          ) : (
            <div className="space-y-2">
              {audits.map((audit) => (
                <a
                  key={audit.id}
                  href={`/audit/performance/${audit.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-md border px-4 py-3 transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium">
                      {audit.completed_at
                        ? formatDate(audit.completed_at, false)
                        : formatDate(audit.created_at, false)}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      audit.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : audit.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {audit.status}
                  </span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/performance/performance-dashboard.tsx
git commit -m "feat(ui): add PerformanceDashboard component"
```

---

### Task 13: Create Performance Audit Results Page

**Files:**

- Create: `app/audit/performance/[id]/page.tsx`
- Create: `app/audit/performance/[id]/actions.ts`

**Step 1: Write the actions file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'

export async function getPerformanceAuditData(id: string): Promise<{
  audit: PerformanceAudit | null
  results: PerformanceAuditResult[]
}> {
  const supabase = await createClient()

  const { data: audit } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (!audit) {
    return { audit: null, results: [] }
  }

  const { data: results } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)
    .order('url')
    .order('device')

  return {
    audit,
    results: results || [],
  }
}
```

**Step 2: Write the page component**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPerformanceAuditData } from './actions'
import { PerformanceResults } from '@/components/performance/performance-results'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PerformanceAuditResultsPage({ params }: Props) {
  const { id } = await params
  const { audit, results } = await getPerformanceAuditData(id)

  if (!audit) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/audit/performance"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Performance Audits
        </Link>
      </div>

      {/* Audit Info */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-balance">Performance Audit</h1>
          <Badge
            variant={
              audit.status === 'completed'
                ? 'success'
                : audit.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {audit.status}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {audit.completed_at
            ? `Completed ${formatDate(audit.completed_at, false)}`
            : audit.started_at
              ? `Started ${formatDate(audit.started_at, false)}`
              : `Created ${formatDate(audit.created_at, false)}`}
        </p>
        {audit.error_message && (
          <p className="mt-2 text-sm text-red-600">{audit.error_message}</p>
        )}
      </div>

      {/* Results */}
      <PerformanceResults results={results} />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/audit/performance/[id]/page.tsx app/audit/performance/[id]/actions.ts
git commit -m "feat(pages): add performance audit results page"
```

---

### Task 14: Add Navigation Tab to Audit Layout

**Files:**

- Modify: `app/audit/layout.tsx`

**Step 1: Read current layout**

Read `app/audit/layout.tsx` to understand current structure.

**Step 2: Update layout to include Performance tab**

Add tabs navigation to switch between Site Audit and Performance Audit:

```typescript
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AuditLayoutProps {
  children: React.ReactNode
}

export default function AuditLayout({ children }: AuditLayoutProps) {
  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b px-8 pt-4">
        <nav className="flex gap-4">
          <NavLink href="/audit">Site Audit</NavLink>
          <NavLink href="/audit/performance">Performance</NavLink>
        </nav>
      </div>
      {children}
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  // Note: This is a simplified version. In production, use usePathname()
  // to determine active state in a client component
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-1 pb-3 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  )
}
```

**Step 3: Commit**

```bash
git add app/audit/layout.tsx
git commit -m "feat(nav): add Performance tab to audit layout"
```

---

## Phase 6: Weekly Cron Job

### Task 15: Create Cron Job Endpoint

**Files:**

- Create: `app/api/cron/weekly-audits/route.ts`

**Step 1: Write the cron endpoint**

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/runner'
import { runPerformanceAudit } from '@/lib/performance/runner'

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all monitored sites
  const { data: sites, error } = await supabase
    .from('monitored_sites')
    .select('*, organizations(website_url)')

  if (error) {
    console.error('[Cron] Failed to fetch monitored sites:', error)
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }

  const results = {
    site_audits_started: 0,
    performance_audits_started: 0,
    errors: [] as string[],
  }

  for (const site of sites || []) {
    // Run Site Audit if enabled
    if (site.run_site_audit) {
      try {
        const { data: audit } = await supabase
          .from('site_audits')
          .insert({
            organization_id: site.organization_id,
            url: site.url,
            status: 'pending',
          })
          .select()
          .single()

        if (audit) {
          runAudit(audit.id, site.url).catch((err) => {
            console.error(`[Cron] Site audit failed for ${site.url}:`, err)
          })
          results.site_audits_started++

          // Update last audit timestamp
          await supabase
            .from('monitored_sites')
            .update({ last_site_audit_at: new Date().toISOString() })
            .eq('id', site.id)
        }
      } catch (err) {
        results.errors.push(`Site audit for ${site.url}: ${err}`)
      }
    }

    // Run Performance Audit if enabled
    if (site.run_performance_audit) {
      try {
        // Get monitored pages for this org
        const { data: pages } = await supabase
          .from('monitored_pages')
          .select('url')
          .eq('organization_id', site.organization_id)

        const urls = [site.url, ...(pages || []).map((p) => p.url)]

        const { data: audit } = await supabase
          .from('performance_audits')
          .insert({
            organization_id: site.organization_id,
            status: 'pending',
          })
          .select()
          .single()

        if (audit) {
          runPerformanceAudit(audit.id, urls).catch((err) => {
            console.error(`[Cron] Performance audit failed for ${site.url}:`, err)
          })
          results.performance_audits_started++

          // Update last audit timestamp
          await supabase
            .from('monitored_sites')
            .update({ last_performance_audit_at: new Date().toISOString() })
            .eq('id', site.id)
        }
      } catch (err) {
        results.errors.push(`Performance audit for ${site.url}: ${err}`)
      }
    }
  }

  console.log('[Cron] Weekly audits completed:', results)
  return NextResponse.json(results)
}
```

**Step 2: Add vercel.json cron configuration**

Create or update `vercel.json`:

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

**Step 3: Add CRON_SECRET to environment variables**

Add to `.env.local.example`:

```
CRON_SECRET=your_cron_secret_here
```

**Step 4: Commit**

```bash
git add app/api/cron/weekly-audits/route.ts vercel.json
git commit -m "feat(cron): add weekly audit cron job"
```

---

### Task 16: Create Monitored Sites Management UI

**Files:**

- Create: `app/settings/monitoring/page.tsx`
- Create: `components/settings/monitored-sites.tsx`

**Step 1: Write the settings page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { MonitoredSitesManager } from '@/components/settings/monitored-sites'

export default async function MonitoringSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return null
  }

  // Get organization website URL
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Get monitored sites
  const { data: sites } = await supabase
    .from('monitored_sites')
    .select('*')
    .eq('organization_id', userRecord.organization_id)

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">Monitoring Settings</h1>
      <MonitoredSitesManager
        sites={sites || []}
        websiteUrl={org?.website_url || null}
        organizationId={userRecord.organization_id}
      />
    </div>
  )
}
```

**Step 2: Write the MonitoredSitesManager component**

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { MonitoredSite } from '@/lib/performance/types'
import { formatDate } from '@/lib/utils'

interface MonitoredSitesManagerProps {
  sites: MonitoredSite[]
  websiteUrl: string | null
  organizationId: string
}

export function MonitoredSitesManager({
  sites: initialSites,
  websiteUrl,
  organizationId,
}: MonitoredSitesManagerProps) {
  const [sites, setSites] = useState(initialSites)
  const [isAdding, setIsAdding] = useState(false)

  const currentSite = sites.find((s) => s.url === websiteUrl)

  const handleAddSite = async () => {
    if (!websiteUrl) return
    setIsAdding(true)

    try {
      const response = await fetch('/api/settings/monitored-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: websiteUrl,
          organization_id: organizationId,
        }),
      })

      if (response.ok) {
        const site = await response.json()
        setSites((prev) => [...prev, site])
      }
    } catch (err) {
      console.error('Failed to add site:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggle = async (siteId: string, field: 'run_site_audit' | 'run_performance_audit', value: boolean) => {
    try {
      await fetch('/api/settings/monitored-sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: siteId, [field]: value }),
      })

      setSites((prev) =>
        prev.map((s) => (s.id === siteId ? { ...s, [field]: value } : s))
      )
    } catch (err) {
      console.error('Failed to update site:', err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Automated Audits</CardTitle>
        <CardDescription>
          Configure automatic weekly audits for your site. Audits run every Sunday at 2am UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentSite && websiteUrl && (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-muted-foreground mb-2 text-sm">
              Enable weekly automated audits for {websiteUrl}
            </p>
            <Button onClick={handleAddSite} disabled={isAdding}>
              {isAdding ? 'Enabling...' : 'Enable Weekly Audits'}
            </Button>
          </div>
        )}

        {currentSite && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="font-medium">{currentSite.url}</div>

            <div className="flex items-center justify-between">
              <Label htmlFor="site-audit" className="flex flex-col gap-1">
                <span>Site Audit (SEO/AIO)</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {currentSite.last_site_audit_at
                    ? `Last run: ${formatDate(currentSite.last_site_audit_at, false)}`
                    : 'Never run'}
                </span>
              </Label>
              <Switch
                id="site-audit"
                checked={currentSite.run_site_audit}
                onCheckedChange={(v) => handleToggle(currentSite.id, 'run_site_audit', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="perf-audit" className="flex flex-col gap-1">
                <span>Performance Audit</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {currentSite.last_performance_audit_at
                    ? `Last run: ${formatDate(currentSite.last_performance_audit_at, false)}`
                    : 'Never run'}
                </span>
              </Label>
              <Switch
                id="perf-audit"
                checked={currentSite.run_performance_audit}
                onCheckedChange={(v) => handleToggle(currentSite.id, 'run_performance_audit', v)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 3: Create the API endpoint for monitored sites management**

Create `app/api/settings/monitored-sites/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { url, organization_id } = body

  const { data, error } = await supabase
    .from('monitored_sites')
    .insert({ url, organization_id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...updates } = body

  const { error } = await supabase.from('monitored_sites').update(updates).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 4: Commit**

```bash
git add app/settings/monitoring/page.tsx components/settings/monitored-sites.tsx app/api/settings/monitored-sites/route.ts
git commit -m "feat(settings): add monitored sites management UI"
```

---

## Phase 7: Integration with Site Audit

### Task 17: Add Performance Audit Launch Button to Site Audit Report

**Files:**

- Modify: `components/audit/check-list.tsx`

**Step 1: Add speedometer icon button to page rows**

In the page-specific collapsible trigger, add a button to launch performance audit for that URL:

```typescript
// Add to imports
import { Gauge } from 'lucide-react'

// Add button next to page URL (inside the CollapsibleTrigger, before the check count)
<Tooltip>
  <TooltipTrigger asChild>
    <button
      onClick={(e) => {
        e.stopPropagation()
        // Navigate to performance audit with this URL pre-selected
        window.location.href = `/audit/performance?url=${encodeURIComponent(page.url)}`
      }}
      className="text-muted-foreground hover:text-foreground ml-2 cursor-pointer rounded p-1 transition-colors"
      aria-label="Run performance audit for this page"
    >
      <Gauge className="size-4" />
    </button>
  </TooltipTrigger>
  <TooltipContent>Run performance audit</TooltipContent>
</Tooltip>
```

**Step 2: Update performance page to accept URL param**

Modify `app/audit/performance/page.tsx` to pre-fill URL from query param.

**Step 3: Commit**

```bash
git add components/audit/check-list.tsx app/audit/performance/page.tsx
git commit -m "feat(integration): add performance audit launch from site audit"
```

---

## Summary

This plan implements:

1. **Database**: 4 new tables with RLS policies
2. **API Integration**: PageSpeed Insights client with metric extraction
3. **API Routes**: Start audit, get results, manage monitored pages
4. **UI Components**: Score gauges, Core Web Vitals display, results page
5. **Pages**: Performance dashboard, results page, settings page
6. **Cron**: Weekly automated audits via Vercel Cron
7. **Integration**: Launch performance audit from site audit report

Total estimated tasks: 17
