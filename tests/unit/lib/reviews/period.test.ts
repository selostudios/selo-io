import { describe, test, expect } from 'vitest'
import {
  parseQuarter,
  periodsForQuarter,
  currentQuarter,
  formatQuarterLabel,
  buildQuarterOptions,
} from '@/lib/reviews/period'

describe('parseQuarter', () => {
  test('parses 2026-Q1 to year/quarter', () => {
    expect(parseQuarter('2026-Q1')).toEqual({ year: 2026, quarter: 1 })
  })

  test('parses each of Q1 through Q4', () => {
    expect(parseQuarter('2025-Q2')).toEqual({ year: 2025, quarter: 2 })
    expect(parseQuarter('2024-Q3')).toEqual({ year: 2024, quarter: 3 })
    expect(parseQuarter('2023-Q4')).toEqual({ year: 2023, quarter: 4 })
  })

  test('throws on malformed input', () => {
    expect(() => parseQuarter('2026-5')).toThrow()
    expect(() => parseQuarter('2026Q1')).toThrow()
    expect(() => parseQuarter('2026-Q0')).toThrow()
    expect(() => parseQuarter('2026-Q5')).toThrow()
    expect(() => parseQuarter('')).toThrow()
  })
})

describe('periodsForQuarter', () => {
  test('Q1 2026 main period is Jan 1–Mar 31, 2026', () => {
    const p = periodsForQuarter('2026-Q1')
    expect(p.main.start).toBe('2026-01-01')
    expect(p.main.end).toBe('2026-03-31')
  })

  test('Q1 2026 prior-quarter is Q4 2025 (crosses year boundary)', () => {
    const p = periodsForQuarter('2026-Q1')
    expect(p.qoq.start).toBe('2025-10-01')
    expect(p.qoq.end).toBe('2025-12-31')
  })

  test('Q1 2026 year-over-year is Q1 2025', () => {
    const p = periodsForQuarter('2026-Q1')
    expect(p.yoy.start).toBe('2025-01-01')
    expect(p.yoy.end).toBe('2025-03-31')
  })

  test('Q3 2026 periods are correct', () => {
    const p = periodsForQuarter('2026-Q3')
    expect(p.main).toEqual({ start: '2026-07-01', end: '2026-09-30' })
    expect(p.qoq).toEqual({ start: '2026-04-01', end: '2026-06-30' })
    expect(p.yoy).toEqual({ start: '2025-07-01', end: '2025-09-30' })
  })

  test('Q4 2024 handles leap-year previous quarter end date', () => {
    const p = periodsForQuarter('2024-Q4')
    expect(p.main).toEqual({ start: '2024-10-01', end: '2024-12-31' })
    expect(p.qoq).toEqual({ start: '2024-07-01', end: '2024-09-30' })
    expect(p.yoy).toEqual({ start: '2023-10-01', end: '2023-12-31' })
  })
})

describe('currentQuarter', () => {
  test('returns quarter string for a given date', () => {
    expect(currentQuarter(new Date('2026-04-20'))).toBe('2026-Q2')
    expect(currentQuarter(new Date('2026-12-31'))).toBe('2026-Q4')
    expect(currentQuarter(new Date('2026-01-01'))).toBe('2026-Q1')
  })

  test('buckets each month into the correct quarter', () => {
    expect(currentQuarter(new Date('2026-03-31'))).toBe('2026-Q1')
    expect(currentQuarter(new Date('2026-04-01'))).toBe('2026-Q2')
    expect(currentQuarter(new Date('2026-06-30'))).toBe('2026-Q2')
    expect(currentQuarter(new Date('2026-07-01'))).toBe('2026-Q3')
    expect(currentQuarter(new Date('2026-09-30'))).toBe('2026-Q3')
    expect(currentQuarter(new Date('2026-10-01'))).toBe('2026-Q4')
  })
})

describe('buildQuarterOptions', () => {
  test('starts with the current quarter and walks back through prior quarters', () => {
    const options = buildQuarterOptions(new Date('2026-04-21'))
    expect(options[0]).toBe('2026-Q2')
    expect(options.slice(0, 4)).toEqual(['2026-Q2', '2026-Q1', '2025-Q4', '2025-Q3'])
  })

  test('does not include future quarters of the current year', () => {
    const options = buildQuarterOptions(new Date('2026-04-21'))
    expect(options).not.toContain('2026-Q3')
    expect(options).not.toContain('2026-Q4')
  })

  test('covers the configured lookback window (2 prior years by default)', () => {
    const options = buildQuarterOptions(new Date('2026-04-21'))
    // current (2) + full 2025 (4) + full 2024 (4) = 10 quarters
    expect(options).toHaveLength(10)
    expect(options[options.length - 1]).toBe('2024-Q1')
  })

  test('respects a custom lookback window', () => {
    const options = buildQuarterOptions(new Date('2026-04-21'), 1)
    // current (2) + full 2025 (4) = 6 quarters
    expect(options).toHaveLength(6)
    expect(options).not.toContain('2024-Q4')
  })
})

describe('formatQuarterLabel', () => {
  test('formats a stored quarter id as a human-readable label', () => {
    expect(formatQuarterLabel('2026-Q1')).toBe('Q1 2026')
  })
  test('handles all four quarters', () => {
    expect(formatQuarterLabel('2025-Q4')).toBe('Q4 2025')
  })
  test('throws on invalid quarter input', () => {
    expect(() => formatQuarterLabel('not-a-quarter')).toThrow()
  })
})
