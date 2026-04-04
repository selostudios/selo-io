import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getDateRanges,
  formatDateString,
  calculateChange,
  sumMetricInRange,
  getLatestMetricValue,
  calculateTrendFromDb,
  buildTimeSeries,
  buildTimeSeriesArray,
} from '@/lib/metrics/helpers'
import type { MetricRecord } from '@/lib/metrics/types'

// Fix "now" so date-dependent functions produce stable results
const FIXED_NOW = new Date(2026, 3, 3, 12, 0, 0) // 2026-04-03 noon

afterEach(() => {
  vi.useRealTimers()
})

function useFakeDate() {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
}

// Helper to build metric records concisely
function rec(date: string, type: string, value: number): MetricRecord {
  return { date, metric_type: type, value }
}

// ─── formatDateString ──────────────────────────────────────────────

describe('formatDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('zero-pads single-digit months and days', () => {
    expect(formatDateString(new Date(2026, 2, 9))).toBe('2026-03-09')
  })
})

// ─── getDateRanges ─────────────────────────────────────────────────

describe('getDateRanges', () => {
  it('returns 7-day current period ending yesterday', () => {
    useFakeDate()
    const { currentStart, currentEnd } = getDateRanges('7d')
    // Yesterday = 2026-04-02
    expect(formatDateString(currentEnd)).toBe('2026-04-02')
    // 7 days back from yesterday = 2026-03-27
    expect(formatDateString(currentStart)).toBe('2026-03-27')
  })

  it('returns 30-day current period ending yesterday', () => {
    useFakeDate()
    const { currentStart, currentEnd } = getDateRanges('30d')
    expect(formatDateString(currentEnd)).toBe('2026-04-02')
    expect(formatDateString(currentStart)).toBe('2026-03-04')
  })

  it('returns 90-day period for quarter', () => {
    useFakeDate()
    const { currentStart, currentEnd } = getDateRanges('quarter')
    expect(formatDateString(currentEnd)).toBe('2026-04-02')
    expect(formatDateString(currentStart)).toBe('2026-01-03')
  })

  it('previous period ends the day before current starts', () => {
    useFakeDate()
    const { currentStart, previousEnd } = getDateRanges('7d')
    const expected = new Date(currentStart)
    expected.setDate(expected.getDate() - 1)
    expect(formatDateString(previousEnd)).toBe(formatDateString(expected))
  })

  it('previous period has the same length as current period', () => {
    useFakeDate()
    const r = getDateRanges('30d')
    const currentDays = Math.round(
      (r.currentEnd.getTime() - r.currentStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    const previousDays = Math.round(
      (r.previousEnd.getTime() - r.previousStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    expect(currentDays).toBe(previousDays)
  })
})

// ─── calculateChange ───────────────────────────────────────────────

describe('calculateChange', () => {
  it('returns positive percentage for growth', () => {
    expect(calculateChange(150, 100)).toBe(50)
  })

  it('returns negative percentage for decline', () => {
    expect(calculateChange(80, 100)).toBe(-20)
  })

  it('returns null when both values are zero', () => {
    expect(calculateChange(0, 0)).toBeNull()
  })

  it('returns 100 when previous is zero and current is positive', () => {
    expect(calculateChange(50, 0)).toBe(100)
  })

  it('caps extreme positive changes at 999%', () => {
    expect(calculateChange(10000, 1)).toBe(999)
  })

  it('caps extreme negative changes at -999%', () => {
    // -999% requires current to be very negative relative to previous
    // e.g., current = -9, previous = 1 → (-9 - 1) / 1 * 100 = -1000 → capped at -999
    expect(calculateChange(-9, 1)).toBe(-999)
  })

  it('returns exact change within ±999% range', () => {
    // 500% change: (600 - 100) / 100 * 100 = 500
    expect(calculateChange(600, 100)).toBe(500)
  })
})

// ─── sumMetricInRange ──────────────────────────────────────────────

describe('sumMetricInRange', () => {
  const metrics: MetricRecord[] = [
    rec('2026-03-28', 'impressions', 100),
    rec('2026-03-29', 'impressions', 200),
    rec('2026-03-30', 'impressions', 150),
    rec('2026-03-28', 'clicks', 10),
  ]

  it('sums values for matching metric type within date range', () => {
    const result = sumMetricInRange(
      metrics,
      'impressions',
      new Date(2026, 2, 28),
      new Date(2026, 2, 30)
    )
    expect(result.sum).toBe(450)
    expect(result.hasData).toBe(true)
  })

  it('returns zero sum and hasData=false when no records match', () => {
    const result = sumMetricInRange(
      metrics,
      'impressions',
      new Date(2026, 3, 1),
      new Date(2026, 3, 5)
    )
    expect(result.sum).toBe(0)
    expect(result.hasData).toBe(false)
  })

  it('filters by metric type correctly', () => {
    const result = sumMetricInRange(metrics, 'clicks', new Date(2026, 2, 28), new Date(2026, 2, 30))
    expect(result.sum).toBe(10)
  })

  it('handles empty metrics array', () => {
    const result = sumMetricInRange([], 'impressions', new Date(2026, 2, 28), new Date(2026, 2, 30))
    expect(result.sum).toBe(0)
    expect(result.hasData).toBe(false)
  })

  it('includes boundary dates in range', () => {
    const result = sumMetricInRange(
      metrics,
      'impressions',
      new Date(2026, 2, 28),
      new Date(2026, 2, 28)
    )
    expect(result.sum).toBe(100)
    expect(result.hasData).toBe(true)
  })
})

// ─── getLatestMetricValue ──────────────────────────────────────────

describe('getLatestMetricValue', () => {
  const metrics: MetricRecord[] = [
    rec('2026-03-01', 'total_contacts', 500),
    rec('2026-03-15', 'total_contacts', 550),
    rec('2026-03-28', 'total_contacts', 600),
    rec('2026-04-01', 'total_contacts', 620),
  ]

  it('returns latest value up to the given end date', () => {
    expect(getLatestMetricValue(metrics, 'total_contacts', new Date(2026, 2, 28))).toBe(600)
  })

  it('returns zero when no matching records exist', () => {
    expect(getLatestMetricValue([], 'total_contacts', new Date(2026, 2, 28))).toBe(0)
  })

  it('returns zero for unmatched metric type', () => {
    expect(getLatestMetricValue(metrics, 'nonexistent', new Date(2026, 3, 1))).toBe(0)
  })

  it('ignores records after the end date', () => {
    expect(getLatestMetricValue(metrics, 'total_contacts', new Date(2026, 2, 20))).toBe(550)
  })
})

// ─── calculateTrendFromDb ──────────────────────────────────────────

describe('calculateTrendFromDb', () => {
  it('computes sum-based trend for period metrics', () => {
    useFakeDate()
    // Current 7d period: 2026-03-27 to 2026-04-02
    // Previous 7d period: 2026-03-20 to 2026-03-26
    const metrics: MetricRecord[] = [
      // Previous period
      rec('2026-03-20', 'impressions', 100),
      rec('2026-03-21', 'impressions', 100),
      // Current period
      rec('2026-03-27', 'impressions', 200),
      rec('2026-03-28', 'impressions', 200),
    ]

    const result = calculateTrendFromDb(metrics, 'impressions', '7d')
    expect(result.current).toBe(400)
    // Change: (400 - 200) / 200 * 100 = 100%
    expect(result.change).toBe(100)
  })

  it('returns null change when no previous period data exists', () => {
    useFakeDate()
    const metrics: MetricRecord[] = [rec('2026-03-27', 'impressions', 200)]

    const result = calculateTrendFromDb(metrics, 'impressions', '7d')
    expect(result.current).toBe(200)
    expect(result.change).toBeNull()
  })

  it('uses latest value for cumulative metrics', () => {
    useFakeDate()
    const metrics: MetricRecord[] = [
      rec('2026-03-20', 'total_contacts', 500),
      rec('2026-03-26', 'total_contacts', 520),
      rec('2026-03-27', 'total_contacts', 530),
      rec('2026-04-02', 'total_contacts', 560),
    ]

    const result = calculateTrendFromDb(metrics, 'total_contacts', '7d', true)
    expect(result.current).toBe(560)
    // Previous latest = 520, change = (560 - 520) / 520 * 100 ≈ 7.69%
    expect(result.change).toBeCloseTo(7.69, 1)
  })

  it('returns zero current with null change for empty metrics', () => {
    useFakeDate()
    const result = calculateTrendFromDb([], 'impressions', '7d')
    expect(result.current).toBe(0)
    expect(result.change).toBeNull()
  })

  it('returns null change for 30-day view when only 30 days of data exists', () => {
    useFakeDate()
    // With now = 2026-04-03, 30d current period is 2026-03-04 to 2026-04-02
    // Previous period would be 2026-02-02 to 2026-03-03
    // Only providing data from 2026-03-05 onwards — no previous period coverage
    const metrics: MetricRecord[] = []
    for (let d = 5; d <= 31; d++) {
      metrics.push(rec(`2026-03-${String(d).padStart(2, '0')}`, 'impressions', 100))
    }
    metrics.push(rec('2026-04-01', 'impressions', 100))
    metrics.push(rec('2026-04-02', 'impressions', 100))

    const result = calculateTrendFromDb(metrics, 'impressions', '30d')
    expect(result.current).toBeGreaterThan(0)
    expect(result.change).toBeNull() // No previous period data → null
  })

  it('shows trend for 7-day view when 30 days of data exists', () => {
    useFakeDate()
    // 7d current: 2026-03-27 to 2026-04-02
    // 7d previous: 2026-03-20 to 2026-03-26
    // Both within a 30-day backfill from 2026-03-05
    const metrics: MetricRecord[] = []
    for (let d = 5; d <= 31; d++) {
      metrics.push(rec(`2026-03-${String(d).padStart(2, '0')}`, 'impressions', 100))
    }
    metrics.push(rec('2026-04-01', 'impressions', 100))
    metrics.push(rec('2026-04-02', 'impressions', 100))

    const result = calculateTrendFromDb(metrics, 'impressions', '7d')
    expect(result.current).toBeGreaterThan(0)
    expect(result.change).not.toBeNull() // Previous period has data → trend shown
  })

  it('shows trend for 30-day view when 60 days of data exists', () => {
    useFakeDate()
    // 30d current: 2026-03-04 to 2026-04-02
    // 30d previous: 2026-02-02 to 2026-03-03
    const metrics: MetricRecord[] = []
    // Generate 60 days of data from Feb 3 to Apr 2
    const start = new Date(2026, 1, 3)
    for (let i = 0; i < 60; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      metrics.push(rec(dateStr, 'impressions', 100))
    }

    const result = calculateTrendFromDb(metrics, 'impressions', '30d')
    expect(result.current).toBeGreaterThan(0)
    expect(result.change).not.toBeNull() // Both periods covered → trend shown
  })
})

// ─── buildTimeSeries ───────────────────────────────────────────────

describe('buildTimeSeries', () => {
  it('filters metrics to current period and sorts by date', () => {
    useFakeDate()
    const metrics: MetricRecord[] = [
      rec('2026-04-01', 'impressions', 300),
      rec('2026-03-27', 'impressions', 100),
      rec('2026-03-29', 'impressions', 200),
      // Outside current 7d period (before 2026-03-27)
      rec('2026-03-20', 'impressions', 50),
    ]

    const series = buildTimeSeries(metrics, 'impressions', 'Impressions', '7d')
    expect(series.metricType).toBe('impressions')
    expect(series.label).toBe('Impressions')
    expect(series.data).toHaveLength(3)
    expect(series.data[0].date).toBe('2026-03-27')
    expect(series.data[1].date).toBe('2026-03-29')
    expect(series.data[2].date).toBe('2026-04-01')
  })

  it('returns empty data array when no metrics match', () => {
    useFakeDate()
    const series = buildTimeSeries([], 'impressions', 'Impressions', '7d')
    expect(series.data).toHaveLength(0)
  })
})

// ─── buildTimeSeriesArray ──────────────────────────────────────────

describe('buildTimeSeriesArray', () => {
  it('builds time series for each metric definition', () => {
    useFakeDate()
    const metrics: MetricRecord[] = [
      rec('2026-03-28', 'impressions', 100),
      rec('2026-03-28', 'clicks', 10),
    ]
    const defs = [
      { metricType: 'impressions', label: 'Impressions' },
      { metricType: 'clicks', label: 'Clicks' },
    ]

    const result = buildTimeSeriesArray(metrics, defs, '7d')
    expect(result).toHaveLength(2)
    expect(result[0].metricType).toBe('impressions')
    expect(result[0].data[0].value).toBe(100)
    expect(result[1].metricType).toBe('clicks')
    expect(result[1].data[0].value).toBe(10)
  })
})
