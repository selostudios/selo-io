import { describe, test, expect } from 'vitest'
import { formatMetricDelta, formatMetricValue } from '@/lib/reviews/format'
import { MetricFormat } from '@/lib/enums'

const EM_DASH = '\u2014'

describe('formatMetricValue', () => {
  test('adds thousands separators to number-format values', () => {
    expect(formatMetricValue(12345, MetricFormat.Number)).toBe('12,345')
  })

  test('rounds percent-format values and appends a percent sign', () => {
    expect(formatMetricValue(42.6, MetricFormat.Percent)).toBe('43%')
  })

  test('returns the default em-dash when value is null', () => {
    expect(formatMetricValue(null, MetricFormat.Number)).toBe(EM_DASH)
  })

  test('honors a custom null fallback', () => {
    expect(formatMetricValue(null, MetricFormat.Number, 'n/a')).toBe('n/a')
  })
})

describe('formatMetricDelta', () => {
  test('prefixes positive deltas with a plus sign and one decimal', () => {
    expect(formatMetricDelta(12.34)).toBe('+12.3%')
  })

  test('keeps the minus sign for negative deltas and pads one decimal', () => {
    expect(formatMetricDelta(-10)).toBe('-10.0%')
  })

  test('returns the default em-dash when delta is null', () => {
    expect(formatMetricDelta(null)).toBe(EM_DASH)
  })

  test('honors a custom null fallback', () => {
    expect(formatMetricDelta(null, '—pending—')).toBe('—pending—')
  })
})
