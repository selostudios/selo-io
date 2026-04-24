import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { fetchLinkedInData } from '@/lib/reviews/fetchers/linkedin'
import { LINKEDIN_FEATURED_METRIC_KEYS } from '@/lib/reviews/linkedin-featured-metrics'
import { createServiceClient } from '@/lib/supabase/server'

type Row = { metric_type: string; date: string; value: number }

function makeMetricsChain(rowsByStart: Record<string, Row[]>, defaultRows: Row[] = []) {
  let capturedStart: string | null = null
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn((_col: string, val: string) => {
      capturedStart = val
      return chain
    }),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (r: { data: Row[]; error: null }) => unknown) => {
      const rows =
        capturedStart !== null ? (rowsByStart[capturedStart] ?? defaultRows) : defaultRows
      return resolve({ data: rows, error: null })
    },
  }
  return chain
}

function makeConnectionChain(connectionRow: { id: string } | null) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: connectionRow, error: null })),
  }
  return chain
}

function mockSupabase(
  rowsByStart: Record<string, Row[]>,
  connectionRow: { id: string } | null = { id: 'conn-1' }
) {
  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'platform_connections') {
        return makeConnectionChain(connectionRow)
      }
      return makeMetricsChain(rowsByStart)
    }),
  } as never)
}

const periods = {
  main: { start: '2026-01-01', end: '2026-03-31' },
  qoq: { start: '2025-10-01', end: '2025-12-31' },
  yoy: { start: '2025-01-01', end: '2025-03-31' },
}

const mainRows: Row[] = [
  { metric_type: 'linkedin_impressions', date: '2026-01-01', value: 1000 },
  { metric_type: 'linkedin_impressions', date: '2026-01-02', value: 1500 },
  { metric_type: 'linkedin_follower_growth', date: '2026-01-01', value: 10 },
  { metric_type: 'linkedin_follower_growth', date: '2026-01-02', value: 15 },
  { metric_type: 'linkedin_page_views', date: '2026-01-01', value: 200 },
  { metric_type: 'linkedin_page_views', date: '2026-01-02', value: 250 },
  { metric_type: 'linkedin_followers', date: '2026-01-01', value: 500 },
  { metric_type: 'linkedin_followers', date: '2026-01-02', value: 525 },
  { metric_type: 'linkedin_reactions', date: '2026-01-01', value: 30 },
]

const qoqRows: Row[] = [
  { metric_type: 'linkedin_impressions', date: '2025-10-01', value: 800 },
  { metric_type: 'linkedin_impressions', date: '2025-10-02', value: 900 },
  { metric_type: 'linkedin_follower_growth', date: '2025-10-01', value: 8 },
  { metric_type: 'linkedin_page_views', date: '2025-10-01', value: 150 },
]

const yoyRows: Row[] = [
  { metric_type: 'linkedin_impressions', date: '2025-01-01', value: 600 },
  { metric_type: 'linkedin_follower_growth', date: '2025-01-01', value: 5 },
  { metric_type: 'linkedin_page_views', date: '2025-01-01', value: 100 },
]

describe('fetchLinkedInData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const rowsByStart: Record<string, Row[]> = {
      [periods.main.start]: mainRows,
      [periods.qoq.start]: qoqRows,
      [periods.yoy.start]: yoyRows,
    }
    mockSupabase(rowsByStart)
  })

  test('returns undefined when the organization has no active LinkedIn connection', async () => {
    mockSupabase({}, null)
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeUndefined()
  })

  test('attaches daily timeseries with {date, value} rows to every featured metric', async () => {
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeDefined()

    for (const key of LINKEDIN_FEATURED_METRIC_KEYS) {
      const triple = data!.metrics[key]
      expect(triple, `expected triple for featured metric ${key}`).toBeDefined()
      expect(triple.timeseries, `expected timeseries on ${key}`).toBeDefined()
      const ts = triple.timeseries!

      for (const period of ['current', 'qoq', 'yoy'] as const) {
        expect(Array.isArray(ts[period])).toBe(true)
        for (const row of ts[period]) {
          expect(typeof row.date).toBe('string')
          expect(typeof row.value).toBe('number')
        }
      }
    }

    const impressions = data!.metrics['linkedin_impressions'].timeseries!
    expect(impressions.current).toEqual([
      { date: '2026-01-01', value: 1000 },
      { date: '2026-01-02', value: 1500 },
    ])
  })

  test('does not attach timeseries to non-featured metrics', async () => {
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeDefined()

    const featured = new Set<string>(LINKEDIN_FEATURED_METRIC_KEYS)
    for (const [key, triple] of Object.entries(data!.metrics)) {
      if (featured.has(key)) continue
      expect(
        triple.timeseries,
        `expected no timeseries on non-featured metric ${key}`
      ).toBeUndefined()
    }
  })

  test('scalar fields on featured metrics reflect summed values and deltas', async () => {
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeDefined()

    // linkedin_impressions: current 1000+1500=2500, qoq 800+900=1700, yoy 600
    const impressions = data!.metrics['linkedin_impressions']
    expect(impressions.current).toBe(2500)
    expect(impressions.qoq).toBe(1700)
    expect(impressions.yoy).toBe(600)

    // linkedin_follower_growth: current 10+15=25
    const growth = data!.metrics['linkedin_follower_growth']
    expect(growth.current).toBe(25)

    // Cumulative metric still uses last value
    const followers = data!.metrics['linkedin_followers']
    expect(followers.current).toBe(525)
  })
})
