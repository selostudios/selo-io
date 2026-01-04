# LinkedIn Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add LinkedIn organization metrics to the main dashboard with period-over-period comparison.

**Architecture:** Server-side LinkedIn adapter fetches metrics via Marketing API, stores daily snapshots in campaign_metrics table, dashboard component queries and displays with percentage change calculation.

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL, LinkedIn Marketing API, Vitest for testing, MSW for API mocking.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260103000020_add_org_to_campaign_metrics.sql`

**Step 1: Write the migration**

```sql
-- Add organization_id to campaign_metrics for org-level metrics
ALTER TABLE campaign_metrics
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Make campaign_id nullable (org-level metrics don't have a campaign)
ALTER TABLE campaign_metrics
ALTER COLUMN campaign_id DROP NOT NULL;

-- Add index for org-level metric queries
CREATE INDEX idx_campaign_metrics_org ON campaign_metrics(organization_id);
CREATE INDEX idx_campaign_metrics_org_date ON campaign_metrics(organization_id, date);

-- Add RLS policy for org-level metrics
CREATE POLICY "Users can view org-level metrics"
  ON campaign_metrics FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
```

**Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260103000020_add_org_to_campaign_metrics.sql
git commit -m "feat(db): add organization_id to campaign_metrics for org-level metrics"
```

---

## Task 2: LinkedIn Types

**Files:**
- Create: `lib/platforms/linkedin/types.ts`

**Step 1: Write LinkedIn-specific types**

```typescript
// LinkedIn API response types

export interface LinkedInFollowerStatistics {
  organizationalEntityFollowerStatistics: {
    elements: Array<{
      timeRange: {
        start: number
        end: number
      }
      followerCounts: {
        organicFollowerCount: number
        paidFollowerCount: number
      }
      followerGains: {
        organicFollowerGain: number
        paidFollowerGain: number
      }
    }>
  }
}

export interface LinkedInPageStatistics {
  organizationPageStatistics: {
    elements: Array<{
      timeRange: {
        start: number
        end: number
      }
      views: {
        allPageViews: {
          pageViews: number
        }
        uniqueVisitors: number
      }
    }>
  }
}

export interface LinkedInShareStatistics {
  organizationalEntityShareStatistics: {
    elements: Array<{
      timeRange: {
        start: number
        end: number
      }
      totalShareStatistics: {
        impressionCount: number
        reactionCount: number
        shareCount: number
        commentCount: number
        clickCount: number
      }
    }>
  }
}

export interface LinkedInCredentials {
  access_token: string
  organization_id: string
}

export interface LinkedInMetrics {
  followers: number
  pageViews: number
  uniqueVisitors: number
  impressions: number
  reactions: number
}

export type LinkedInMetricType =
  | 'linkedin_followers'
  | 'linkedin_page_views'
  | 'linkedin_unique_visitors'
  | 'linkedin_impressions'
  | 'linkedin_reactions'

export const LINKEDIN_METRIC_TYPES: LinkedInMetricType[] = [
  'linkedin_followers',
  'linkedin_page_views',
  'linkedin_unique_visitors',
  'linkedin_impressions',
  'linkedin_reactions',
]
```

**Step 2: Commit**

```bash
git add lib/platforms/linkedin/types.ts
git commit -m "feat(linkedin): add TypeScript types for LinkedIn API responses"
```

---

## Task 3: LinkedIn API Client

**Files:**
- Create: `tests/unit/lib/platforms/linkedin/client.test.ts`
- Create: `lib/platforms/linkedin/client.ts`

**Step 1: Write failing tests for the client**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

describe('LinkedInClient', () => {
  const mockCredentials = {
    access_token: 'test-token',
    organization_id: '12345678',
  }

  describe('constructor', () => {
    it('should create client with credentials', () => {
      const client = new LinkedInClient(mockCredentials)
      expect(client).toBeDefined()
    })
  })

  describe('getFollowerStatistics', () => {
    it('should fetch follower statistics for date range', async () => {
      const client = new LinkedInClient(mockCredentials)
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-07')

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          elements: [{
            followerGains: { organicFollowerGain: 25, paidFollowerGain: 5 }
          }]
        })
      })

      const result = await client.getFollowerStatistics(startDate, endDate)
      expect(result.followers).toBe(30)
    })

    it('should throw on API error', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(client.getFollowerStatistics(new Date(), new Date()))
        .rejects.toThrow('LinkedIn API error: 401')
    })
  })

  describe('getPageStatistics', () => {
    it('should fetch page views and unique visitors', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          elements: [{
            views: {
              allPageViews: { pageViews: 500 },
              uniqueVisitors: 250
            }
          }]
        })
      })

      const result = await client.getPageStatistics(new Date(), new Date())
      expect(result.pageViews).toBe(500)
      expect(result.uniqueVisitors).toBe(250)
    })
  })

  describe('getShareStatistics', () => {
    it('should fetch impressions and reactions', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          elements: [{
            totalShareStatistics: {
              impressionCount: 3000,
              reactionCount: 50
            }
          }]
        })
      })

      const result = await client.getShareStatistics(new Date(), new Date())
      expect(result.impressions).toBe(3000)
      expect(result.reactions).toBe(50)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/lib/platforms/linkedin/client.test.ts`
Expected: FAIL - module not found

**Step 3: Implement the client**

```typescript
import type { LinkedInCredentials, LinkedInMetrics } from './types'

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'

export class LinkedInClient {
  private accessToken: string
  private organizationId: string

  constructor(credentials: LinkedInCredentials) {
    this.accessToken = credentials.access_token
    this.organizationId = credentials.organization_id
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${LINKEDIN_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    return response.json()
  }

  private formatDate(date: Date): number {
    return date.getTime()
  }

  async getFollowerStatistics(startDate: Date, endDate: Date): Promise<{ followers: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${this.formatDate(startDate)},end:${this.formatDate(endDate)})`

    const data = await this.fetch<{ elements: Array<{ followerGains: { organicFollowerGain: number; paidFollowerGain: number } }> }>(
      `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`
    )

    const totalGain = data.elements.reduce((sum, el) => {
      return sum + (el.followerGains?.organicFollowerGain || 0) + (el.followerGains?.paidFollowerGain || 0)
    }, 0)

    return { followers: totalGain }
  }

  async getPageStatistics(startDate: Date, endDate: Date): Promise<{ pageViews: number; uniqueVisitors: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${this.formatDate(startDate)},end:${this.formatDate(endDate)})`

    const data = await this.fetch<{ elements: Array<{ views: { allPageViews: { pageViews: number }; uniqueVisitors: number } }> }>(
      `/organizationPageStatistics?q=organization&organization=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`
    )

    const totals = data.elements.reduce(
      (acc, el) => ({
        pageViews: acc.pageViews + (el.views?.allPageViews?.pageViews || 0),
        uniqueVisitors: acc.uniqueVisitors + (el.views?.uniqueVisitors || 0),
      }),
      { pageViews: 0, uniqueVisitors: 0 }
    )

    return totals
  }

  async getShareStatistics(startDate: Date, endDate: Date): Promise<{ impressions: number; reactions: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${this.formatDate(startDate)},end:${this.formatDate(endDate)})`

    const data = await this.fetch<{ elements: Array<{ totalShareStatistics: { impressionCount: number; reactionCount: number } }> }>(
      `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`
    )

    const totals = data.elements.reduce(
      (acc, el) => ({
        impressions: acc.impressions + (el.totalShareStatistics?.impressionCount || 0),
        reactions: acc.reactions + (el.totalShareStatistics?.reactionCount || 0),
      }),
      { impressions: 0, reactions: 0 }
    )

    return totals
  }

  async getAllMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    const [followers, pageStats, shareStats] = await Promise.all([
      this.getFollowerStatistics(startDate, endDate),
      this.getPageStatistics(startDate, endDate),
      this.getShareStatistics(startDate, endDate),
    ])

    return {
      followers: followers.followers,
      pageViews: pageStats.pageViews,
      uniqueVisitors: pageStats.uniqueVisitors,
      impressions: shareStats.impressions,
      reactions: shareStats.reactions,
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/lib/platforms/linkedin/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/lib/platforms/linkedin/client.test.ts lib/platforms/linkedin/client.ts
git commit -m "feat(linkedin): add LinkedIn API client with follower, page, and share statistics"
```

---

## Task 4: Date Utilities for Period Comparison

**Files:**
- Create: `tests/unit/lib/utils/date-ranges.test.ts`
- Create: `lib/utils/date-ranges.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getDateRange,
  getPreviousPeriodRange,
  getCalendarQuarterRange,
  getPreviousQuarterRange,
} from '@/lib/utils/date-ranges'

describe('date-ranges', () => {
  beforeEach(() => {
    // Mock current date to 2026-01-15
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getDateRange', () => {
    it('should return last 7 days range', () => {
      const range = getDateRange('7d')
      expect(range.start.toISOString().split('T')[0]).toBe('2026-01-08')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-01-15')
    })

    it('should return last 30 days range', () => {
      const range = getDateRange('30d')
      expect(range.start.toISOString().split('T')[0]).toBe('2025-12-16')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-01-15')
    })

    it('should return current quarter range', () => {
      const range = getDateRange('quarter')
      expect(range.start.toISOString().split('T')[0]).toBe('2026-01-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-01-15')
    })
  })

  describe('getPreviousPeriodRange', () => {
    it('should return previous 7 days for 7d period', () => {
      const current = getDateRange('7d')
      const previous = getPreviousPeriodRange(current, '7d')
      expect(previous.start.toISOString().split('T')[0]).toBe('2026-01-01')
      expect(previous.end.toISOString().split('T')[0]).toBe('2026-01-07')
    })
  })

  describe('getCalendarQuarterRange', () => {
    it('should return Q1 for January', () => {
      const range = getCalendarQuarterRange(new Date('2026-01-15'))
      expect(range.start.toISOString().split('T')[0]).toBe('2026-01-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-03-31')
    })

    it('should return Q2 for May', () => {
      const range = getCalendarQuarterRange(new Date('2026-05-15'))
      expect(range.start.toISOString().split('T')[0]).toBe('2026-04-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-06-30')
    })
  })

  describe('getPreviousQuarterRange', () => {
    it('should return Q4 2025 for Q1 2026', () => {
      const range = getPreviousQuarterRange(new Date('2026-01-15'))
      expect(range.start.toISOString().split('T')[0]).toBe('2025-10-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2025-12-31')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/lib/utils/date-ranges.test.ts`
Expected: FAIL - module not found

**Step 3: Implement date utilities**

```typescript
export type DateRangePeriod = '7d' | '30d' | 'quarter'

export interface DateRange {
  start: Date
  end: Date
}

export function getDateRange(period: DateRangePeriod): DateRange {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  if (period === '7d') {
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }

  if (period === '30d') {
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }

  // Quarter - from start of current quarter to today
  const quarterStart = getCalendarQuarterRange(end).start
  return { start: quarterStart, end }
}

export function getPreviousPeriodRange(currentRange: DateRange, period: DateRangePeriod): DateRange {
  if (period === 'quarter') {
    return getPreviousQuarterRange(currentRange.start)
  }

  const daysDiff = Math.ceil((currentRange.end.getTime() - currentRange.start.getTime()) / (1000 * 60 * 60 * 24))

  const end = new Date(currentRange.start)
  end.setDate(end.getDate() - 1)
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - daysDiff + 1)
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

export function getCalendarQuarterRange(date: Date): DateRange {
  const month = date.getMonth()
  const year = date.getFullYear()

  const quarterStartMonth = Math.floor(month / 3) * 3
  const quarterEndMonth = quarterStartMonth + 2

  const start = new Date(year, quarterStartMonth, 1, 0, 0, 0, 0)
  const end = new Date(year, quarterEndMonth + 1, 0, 23, 59, 59, 999) // Last day of quarter

  return { start, end }
}

export function getPreviousQuarterRange(date: Date): DateRange {
  const month = date.getMonth()
  const year = date.getFullYear()

  const currentQuarter = Math.floor(month / 3)

  let prevQuarterStartMonth: number
  let prevYear: number

  if (currentQuarter === 0) {
    // Q1 -> previous Q4
    prevQuarterStartMonth = 9 // October
    prevYear = year - 1
  } else {
    prevQuarterStartMonth = (currentQuarter - 1) * 3
    prevYear = year
  }

  const start = new Date(prevYear, prevQuarterStartMonth, 1, 0, 0, 0, 0)
  const end = new Date(prevYear, prevQuarterStartMonth + 3, 0, 23, 59, 59, 999)

  return { start, end }
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/lib/utils/date-ranges.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/lib/utils/date-ranges.test.ts lib/utils/date-ranges.ts
git commit -m "feat(utils): add date range utilities for period comparison"
```

---

## Task 5: LinkedIn Adapter

**Files:**
- Create: `tests/unit/lib/platforms/linkedin/adapter.test.ts`
- Create: `lib/platforms/linkedin/adapter.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { LinkedInAdapter } from '@/lib/platforms/linkedin/adapter'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

vi.mock('@/lib/platforms/linkedin/client')

describe('LinkedInAdapter', () => {
  const mockCredentials = {
    access_token: 'test-token',
    organization_id: '12345678',
  }

  describe('fetchMetrics', () => {
    it('should fetch all metrics for a date range', async () => {
      const mockGetAllMetrics = vi.fn().mockResolvedValue({
        followers: 30,
        pageViews: 500,
        uniqueVisitors: 250,
        impressions: 3000,
        reactions: 50,
      })

      vi.mocked(LinkedInClient).mockImplementation(() => ({
        getAllMetrics: mockGetAllMetrics,
      } as unknown as LinkedInClient))

      const adapter = new LinkedInAdapter(mockCredentials)
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-07')

      const metrics = await adapter.fetchMetrics(startDate, endDate)

      expect(metrics).toEqual({
        followers: 30,
        pageViews: 500,
        uniqueVisitors: 250,
        impressions: 3000,
        reactions: 50,
      })
    })
  })

  describe('normalizeToDbRecords', () => {
    it('should convert metrics to database records', () => {
      const adapter = new LinkedInAdapter(mockCredentials)
      const metrics = {
        followers: 30,
        pageViews: 500,
        uniqueVisitors: 250,
        impressions: 3000,
        reactions: 50,
      }
      const orgId = 'org-123'
      const date = new Date('2026-01-07')

      const records = adapter.normalizeToDbRecords(metrics, orgId, date)

      expect(records).toHaveLength(5)
      expect(records).toContainEqual({
        organization_id: orgId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: '2026-01-07',
        metric_type: 'linkedin_followers',
        value: 30,
      })
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/lib/platforms/linkedin/adapter.test.ts`
Expected: FAIL - module not found

**Step 3: Implement the adapter**

```typescript
import { LinkedInClient } from './client'
import type { LinkedInCredentials, LinkedInMetrics, LinkedInMetricType } from './types'

interface MetricRecord {
  organization_id: string
  campaign_id: null
  platform_type: 'linkedin'
  date: string
  metric_type: LinkedInMetricType
  value: number
}

export class LinkedInAdapter {
  private client: LinkedInClient

  constructor(credentials: LinkedInCredentials) {
    this.client = new LinkedInClient(credentials)
  }

  async fetchMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    return this.client.getAllMetrics(startDate, endDate)
  }

  normalizeToDbRecords(metrics: LinkedInMetrics, organizationId: string, date: Date): MetricRecord[] {
    const dateStr = date.toISOString().split('T')[0]

    return [
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_followers',
        value: metrics.followers,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_page_views',
        value: metrics.pageViews,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_unique_visitors',
        value: metrics.uniqueVisitors,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_impressions',
        value: metrics.impressions,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_reactions',
        value: metrics.reactions,
      },
    ]
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/lib/platforms/linkedin/adapter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/lib/platforms/linkedin/adapter.test.ts lib/platforms/linkedin/adapter.ts
git commit -m "feat(linkedin): add adapter to fetch and normalize LinkedIn metrics"
```

---

## Task 6: LinkedIn Server Actions

**Files:**
- Create: `lib/platforms/linkedin/actions.ts`

**Step 1: Implement sync action**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAdapter } from './adapter'
import type { LinkedInCredentials } from './types'

export async function syncLinkedInMetrics() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { error: 'User not found' }
  }

  // Get LinkedIn connection
  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id, credentials')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .single()

  if (!connection) {
    return { error: 'LinkedIn not connected' }
  }

  const credentials = connection.credentials as LinkedInCredentials

  try {
    const adapter = new LinkedInAdapter(credentials)

    // Fetch metrics for the last 90 days to cover all time ranges
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const metrics = await adapter.fetchMetrics(startDate, endDate)
    const records = adapter.normalizeToDbRecords(metrics, userRecord.organization_id, endDate)

    // Upsert metrics (delete existing for today, insert new)
    const today = endDate.toISOString().split('T')[0]

    await supabase
      .from('campaign_metrics')
      .delete()
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', 'linkedin')
      .eq('date', today)

    const { error: insertError } = await supabase
      .from('campaign_metrics')
      .insert(records)

    if (insertError) {
      console.error('[LinkedIn Sync Error]', insertError)
      return { error: 'Failed to save metrics' }
    }

    // Update last_sync_at
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('[LinkedIn Sync Error]', error)
    if (error instanceof Error && error.message.includes('401')) {
      return { error: 'LinkedIn token expired. Please reconnect.' }
    }
    return { error: 'Failed to fetch LinkedIn metrics' }
  }
}

export async function getLinkedInMetrics(period: '7d' | '30d' | 'quarter') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { error: 'User not found' }
  }

  // Import date utilities
  const { getDateRange, getPreviousPeriodRange, calculatePercentageChange } = await import('@/lib/utils/date-ranges')

  const currentRange = getDateRange(period)
  const previousRange = getPreviousPeriodRange(currentRange, period)

  // Fetch current period metrics
  const { data: currentMetrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .gte('date', currentRange.start.toISOString().split('T')[0])
    .lte('date', currentRange.end.toISOString().split('T')[0])

  // Fetch previous period metrics
  const { data: previousMetrics } = await supabase
    .from('campaign_metrics')
    .select('metric_type, value')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .gte('date', previousRange.start.toISOString().split('T')[0])
    .lte('date', previousRange.end.toISOString().split('T')[0])

  // Aggregate by metric type
  const aggregate = (metrics: Array<{ metric_type: string; value: number }> | null) => {
    const result: Record<string, number> = {}
    metrics?.forEach(m => {
      result[m.metric_type] = (result[m.metric_type] || 0) + Number(m.value)
    })
    return result
  }

  const current = aggregate(currentMetrics)
  const previous = aggregate(previousMetrics)

  const metricTypes = [
    { key: 'linkedin_followers', label: 'New followers' },
    { key: 'linkedin_page_views', label: 'Page views' },
    { key: 'linkedin_unique_visitors', label: 'Unique visitors' },
    { key: 'linkedin_impressions', label: 'Impressions' },
    { key: 'linkedin_reactions', label: 'Reactions' },
  ]

  const result = metricTypes.map(({ key, label }) => ({
    label,
    value: current[key] || 0,
    change: calculatePercentageChange(current[key] || 0, previous[key] || 0),
  }))

  return { metrics: result }
}
```

**Step 2: Commit**

```bash
git add lib/platforms/linkedin/actions.ts
git commit -m "feat(linkedin): add server actions for syncing and fetching metrics"
```

---

## Task 7: Metric Card Component

**Files:**
- Create: `tests/unit/components/dashboard/metric-card.test.tsx`
- Create: `components/dashboard/metric-card.tsx`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '@/components/dashboard/metric-card'

describe('MetricCard', () => {
  it('should render value and label', () => {
    render(<MetricCard label="Followers" value={220} change={null} />)

    expect(screen.getByText('220')).toBeInTheDocument()
    expect(screen.getByText('Followers')).toBeInTheDocument()
  })

  it('should format large numbers with commas', () => {
    render(<MetricCard label="Impressions" value={2976} change={13.5} />)

    expect(screen.getByText('2,976')).toBeInTheDocument()
  })

  it('should show positive change in green with up arrow', () => {
    render(<MetricCard label="Followers" value={220} change={746.2} />)

    const changeElement = screen.getByText(/746.2%/)
    expect(changeElement).toHaveClass('text-green-600')
    expect(screen.getByText('▲')).toBeInTheDocument()
  })

  it('should show negative change in red with down arrow', () => {
    render(<MetricCard label="Reactions" value={53} change={-35.4} />)

    const changeElement = screen.getByText(/35.4%/)
    expect(changeElement).toHaveClass('text-red-600')
    expect(screen.getByText('▼')).toBeInTheDocument()
  })

  it('should not show change when null', () => {
    render(<MetricCard label="Followers" value={220} change={null} />)

    expect(screen.queryByText('▲')).not.toBeInTheDocument()
    expect(screen.queryByText('▼')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/components/dashboard/metric-card.test.tsx`
Expected: FAIL - module not found

**Step 3: Implement MetricCard component**

```typescript
interface MetricCardProps {
  label: string
  value: number
  change: number | null
}

export function MetricCard({ label, value, change }: MetricCardProps) {
  const formattedValue = value.toLocaleString()

  const isPositive = change !== null && change >= 0
  const isNegative = change !== null && change < 0

  return (
    <div className="flex flex-col">
      <span className="text-2xl font-bold">{formattedValue}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
      {change !== null && (
        <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '▲' : '▼'}
          {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/components/dashboard/metric-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/components/dashboard/metric-card.test.tsx components/dashboard/metric-card.tsx
git commit -m "feat(ui): add MetricCard component with percentage change indicator"
```

---

## Task 8: LinkedIn Dashboard Section

**Files:**
- Create: `components/dashboard/linkedin-section.tsx`

**Step 1: Implement LinkedIn section component**

```typescript
'use client'

import { useState, useEffect, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetricCard } from './metric-card'
import { syncLinkedInMetrics, getLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

type Period = '7d' | '30d' | 'quarter'

interface Metric {
  label: string
  value: number
  change: number | null
}

interface LinkedInSectionProps {
  isConnected: boolean
  lastSyncAt: string | null
}

export function LinkedInSection({ isConnected, lastSyncAt }: LinkedInSectionProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (isConnected) {
      loadMetrics()
    }
  }, [isConnected, period])

  async function loadMetrics() {
    startTransition(async () => {
      const result = await getLinkedInMetrics(period)
      if (result.metrics) {
        setMetrics(result.metrics)
      }
    })
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    const result = await syncLinkedInMetrics()

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('LinkedIn metrics updated')
      await loadMetrics()
    }
    setIsRefreshing(false)
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect LinkedIn in Settings to view metrics.
          </p>
        </CardContent>
      </Card>
    )
  }

  const periodLabels: Record<Period, string> = {
    '7d': '7 days',
    '30d': '30 days',
    'quarter': 'This quarter',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>LinkedIn</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </div>
        {lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(lastSyncAt).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-muted-foreground">Loading metrics...</p>
        ) : metrics.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                change={metric.change}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No data yet. Click refresh to sync metrics.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add components/dashboard/linkedin-section.tsx
git commit -m "feat(ui): add LinkedIn dashboard section with period selector and refresh"
```

---

## Task 9: Update Dashboard Page

**Files:**
- Modify: `app/dashboard/page.tsx`

**Step 1: Update dashboard to include LinkedIn section**

Add imports and fetch LinkedIn connection status, then add the component:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkedInSection } from '@/components/dashboard/linkedin-section'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('organization:organizations(name), organization_id')
    .eq('id', user.id)
    .single()

  if (userError || !userRecord || !userRecord.organization_id) {
    redirect('/onboarding')
  }

  // Get campaign count with error handling
  const { count: campaignCount, error: campaignError } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)

  if (campaignError) {
    console.error('[Dashboard Error]', { type: 'campaign_count', timestamp: new Date().toISOString() })
  }

  // Get active campaigns with error handling
  const { count: activeCount, error: activeError } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)
    .eq('status', 'active')

  if (activeError) {
    console.error('[Dashboard Error]', { type: 'active_count', timestamp: new Date().toISOString() })
  }

  // Get LinkedIn connection status
  const { data: linkedInConnection } = await supabase
    .from('platform_connections')
    .select('id, last_sync_at')
    .eq('organization_id', userRecord.organization_id)
    .eq('platform_type', 'linkedin')
    .single()

  // Get platform connection count
  const { count: connectionCount } = await supabase
    .from('platform_connections')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to {(userRecord?.organization as unknown as { name: string } | null)?.name || 'Selo IO'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your marketing performance across all platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaignCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Platform Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{connectionCount || 0}</p>
            {!connectionCount && (
              <p className="text-sm text-muted-foreground mt-2">
                Connect platforms in Settings
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <LinkedInSection
        isConnected={!!linkedInConnection}
        lastSyncAt={linkedInConnection?.last_sync_at || null}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(dashboard): add LinkedIn metrics section to main dashboard"
```

---

## Task 10: LinkedIn Connect Dialog

**Files:**
- Create: `components/integrations/linkedin-connect-dialog.tsx`

**Step 1: Implement connect dialog**

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { connectPlatform } from '@/app/settings/integrations/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

export function LinkedInConnectDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [organizationId, setOrganizationId] = useState('')
  const [accessToken, setAccessToken] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!organizationId.trim() || !accessToken.trim()) {
      showError('Please fill in all fields')
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    formData.append('platform_type', 'linkedin')
    formData.append('credentials', JSON.stringify({
      organization_id: organizationId.trim(),
      access_token: accessToken.trim(),
    }))

    const result = await connectPlatform(formData)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('LinkedIn connected successfully')
      setOpen(false)
      setOrganizationId('')
      setAccessToken('')
    }

    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Connect</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect LinkedIn</DialogTitle>
          <DialogDescription>
            Enter your LinkedIn organization credentials to start tracking metrics.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationId">Organization ID</Label>
            <Input
              id="organizationId"
              placeholder="12345678"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Found in your LinkedIn Company Page URL (e.g., linkedin.com/company/12345678)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <Input
              id="accessToken"
              type="password"
              placeholder="Enter your access token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Generate at developers.linkedin.com with r_organization_social and r_organization_admin scopes
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add components/integrations/linkedin-connect-dialog.tsx
git commit -m "feat(ui): add LinkedIn connect dialog for credential entry"
```

---

## Task 11: Update Platform Connection Card for LinkedIn

**Files:**
- Modify: `components/settings/platform-connection-card.tsx`

**Step 1: Add LinkedIn connect dialog to card**

Update the component to use the connect dialog for LinkedIn:

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { disconnectPlatform } from '@/app/settings/integrations/actions'
import { LinkedInConnectDialog } from '@/components/integrations/linkedin-connect-dialog'

type Connection = {
  id: string
  platform_type: string
  status: string
  last_sync_at: string | null
}

const platformInfo = {
  hubspot: {
    name: 'HubSpot',
    description: 'Email campaigns, leads, deals, events',
  },
  google_analytics: {
    name: 'Google Analytics',
    description: 'Website traffic, conversions, UTM tracking',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Post impressions, engagement, followers',
  },
}

export function PlatformConnectionCard({ connection, platformType }: { connection: Connection | null, platformType: string }) {
  const platformKey = (connection?.platform_type || platformType) as keyof typeof platformInfo
  const info = platformInfo[platformKey] || { name: 'Unknown Platform', description: 'Unknown platform' }

  async function handleDisconnect() {
    'use server'
    if (connection) {
      await disconnectPlatform(connection.id)
    }
  }

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{info.name}</CardTitle>
            <Badge variant="warning">Not connected</Badge>
          </div>
          <CardDescription>{info.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {platformType === 'linkedin' ? (
            <LinkedInConnectDialog />
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect {info.name} to track performance metrics.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{info.name}</CardTitle>
          <Badge variant="success">{connection.status}</Badge>
        </div>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connection.last_sync_at && (
            <p className="text-sm text-muted-foreground">
              Last synced: {new Date(connection.last_sync_at).toLocaleString()}
            </p>
          )}
          <form action={handleDisconnect}>
            <Button type="submit" variant="outline" size="sm">
              Disconnect
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/platform-connection-card.tsx
git commit -m "feat(integrations): add LinkedIn connect dialog to platform card"
```

---

## Task 12: Create Index Exports

**Files:**
- Create: `lib/platforms/linkedin/index.ts`

**Step 1: Create barrel export**

```typescript
export { LinkedInClient } from './client'
export { LinkedInAdapter } from './adapter'
export * from './types'
export { syncLinkedInMetrics, getLinkedInMetrics } from './actions'
```

**Step 2: Commit**

```bash
git add lib/platforms/linkedin/index.ts
git commit -m "chore(linkedin): add barrel export for LinkedIn module"
```

---

## Task 13: Run All Tests

**Step 1: Run full test suite**

Run: `npm run test:unit`
Expected: All tests PASS

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

---

## Task 14: Final Commit and Push

**Step 1: Final commit if any uncommitted changes**

```bash
git status
# If changes exist:
git add .
git commit -m "chore: cleanup and final adjustments for LinkedIn integration"
```

**Step 2: Push to remote**

```bash
git push origin feature/mvp-implementation
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `supabase/migrations/20260103000020_*.sql` |
| 2 | LinkedIn types | `lib/platforms/linkedin/types.ts` |
| 3 | LinkedIn API client | `lib/platforms/linkedin/client.ts` |
| 4 | Date utilities | `lib/utils/date-ranges.ts` |
| 5 | LinkedIn adapter | `lib/platforms/linkedin/adapter.ts` |
| 6 | Server actions | `lib/platforms/linkedin/actions.ts` |
| 7 | Metric card component | `components/dashboard/metric-card.tsx` |
| 8 | LinkedIn dashboard section | `components/dashboard/linkedin-section.tsx` |
| 9 | Update dashboard page | `app/dashboard/page.tsx` |
| 10 | LinkedIn connect dialog | `components/integrations/linkedin-connect-dialog.tsx` |
| 11 | Update platform card | `components/settings/platform-connection-card.tsx` |
| 12 | Index exports | `lib/platforms/linkedin/index.ts` |
| 13 | Run tests | - |
| 14 | Push | - |
