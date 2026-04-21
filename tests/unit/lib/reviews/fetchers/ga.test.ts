import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { fetchGAData, GA_METRICS } from '@/lib/reviews/fetchers/ga'
import { GA_FEATURED_METRIC_KEYS } from '@/lib/reviews/featured-metrics'
import { createServiceClient } from '@/lib/supabase/server'

type Row = { metric_type: string; date: string; value: number }

function makeAwaitableChain(rowsByStart: Record<string, Row[]>, defaultRows: Row[] = []) {
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
    then: (resolve: (r: { data: Row[]; error: null }) => unknown) => {
      const rows =
        capturedStart !== null ? (rowsByStart[capturedStart] ?? defaultRows) : defaultRows
      return resolve({ data: rows, error: null })
    },
  }
  return chain
}

const periods = {
  main: { start: '2026-01-01', end: '2026-03-31' },
  qoq: { start: '2025-10-01', end: '2025-12-31' },
  yoy: { start: '2025-01-01', end: '2025-03-31' },
}

const mainRows: Row[] = [
  { metric_type: 'ga_sessions', date: '2026-01-01', value: 100 },
  { metric_type: 'ga_sessions', date: '2026-01-02', value: 150 },
  { metric_type: 'ga_active_users', date: '2026-01-01', value: 80 },
  { metric_type: 'ga_active_users', date: '2026-01-02', value: 90 },
  { metric_type: 'ga_new_users', date: '2026-01-01', value: 20 },
  { metric_type: 'ga_new_users', date: '2026-01-02', value: 25 },
  { metric_type: 'ga_traffic_direct', date: '2026-01-01', value: 40 },
  { metric_type: 'ga_traffic_direct', date: '2026-01-02', value: 45 },
]

const qoqRows: Row[] = [
  { metric_type: 'ga_sessions', date: '2025-10-01', value: 90 },
  { metric_type: 'ga_sessions', date: '2025-10-02', value: 110 },
  { metric_type: 'ga_active_users', date: '2025-10-01', value: 70 },
  { metric_type: 'ga_new_users', date: '2025-10-01', value: 15 },
  { metric_type: 'ga_traffic_direct', date: '2025-10-01', value: 30 },
]

const yoyRows: Row[] = [
  { metric_type: 'ga_sessions', date: '2025-01-01', value: 80 },
  { metric_type: 'ga_sessions', date: '2025-01-02', value: 100 },
  { metric_type: 'ga_active_users', date: '2025-01-01', value: 60 },
  { metric_type: 'ga_new_users', date: '2025-01-01', value: 10 },
  { metric_type: 'ga_traffic_direct', date: '2025-01-01', value: 25 },
]

describe('fetchGAData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const rowsByStart: Record<string, Row[]> = {
      [periods.main.start]: mainRows,
      [periods.qoq.start]: qoqRows,
      [periods.yoy.start]: yoyRows,
    }
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => makeAwaitableChain(rowsByStart)),
    } as never)
  })

  test('attaches daily timeseries with {date, value} rows to every featured metric', async () => {
    const data = await fetchGAData('org-1', periods)

    for (const key of GA_FEATURED_METRIC_KEYS) {
      const triple = data[key]
      expect(triple, `expected triple for featured metric ${key}`).toBeDefined()
      expect(triple.timeseries, `expected timeseries on ${key}`).toBeDefined()
      const ts = triple.timeseries!

      // Every row must be { date: string, value: number }
      for (const period of ['current', 'qoq', 'yoy'] as const) {
        expect(Array.isArray(ts[period])).toBe(true)
        for (const row of ts[period]) {
          expect(typeof row.date).toBe('string')
          expect(typeof row.value).toBe('number')
        }
      }
    }

    // Spot check counts/values for ga_sessions
    const sessions = data['ga_sessions'].timeseries!
    expect(sessions.current).toEqual([
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 150 },
    ])
    expect(sessions.qoq).toEqual([
      { date: '2025-10-01', value: 90 },
      { date: '2025-10-02', value: 110 },
    ])
    expect(sessions.yoy).toEqual([
      { date: '2025-01-01', value: 80 },
      { date: '2025-01-02', value: 100 },
    ])
  })

  test('does not attach timeseries to non-featured metrics', async () => {
    const data = await fetchGAData('org-1', periods)

    // Every non-featured metric should have no timeseries
    const featured = new Set<string>(GA_FEATURED_METRIC_KEYS)
    for (const metric of GA_METRICS) {
      if (featured.has(metric)) continue
      expect(
        data[metric].timeseries,
        `expected no timeseries on non-featured metric ${metric}`
      ).toBeUndefined()
    }

    // Explicit check for ga_traffic_direct (called out in the spec)
    expect(data['ga_traffic_direct']).toBeDefined()
    expect(data['ga_traffic_direct'].timeseries).toBeUndefined()
  })

  test('scalar fields on featured metrics still reflect summed values and deltas', async () => {
    const data = await fetchGAData('org-1', periods)

    // ga_sessions: current 100+150=250, qoq 90+110=200, yoy 80+100=180
    const sessions = data['ga_sessions']
    expect(sessions.current).toBe(250)
    expect(sessions.qoq).toBe(200)
    expect(sessions.yoy).toBe(180)
    // (250-200)/200 * 100 = 25.0
    expect(sessions.qoq_delta_pct).toBe(25)
    // (250-180)/180 * 100 = 38.888... → 38.9
    expect(sessions.yoy_delta_pct).toBe(38.9)

    // Non-featured scalar still works as before
    const direct = data['ga_traffic_direct']
    expect(direct.current).toBe(85) // 40+45
    expect(direct.qoq).toBe(30)
    expect(direct.yoy).toBe(25)
  })
})
