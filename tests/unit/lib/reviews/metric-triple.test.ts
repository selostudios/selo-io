import { describe, test, expect } from 'vitest'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'

describe('buildMetricTriple', () => {
  test('sums series and computes delta percentages', () => {
    const t = buildMetricTriple({
      current: [100, 200, 300],
      qoq: [100, 200, 100],
      yoy: [50, 50, 100],
    })
    expect(t.current).toBe(600)
    expect(t.qoq).toBe(400)
    expect(t.yoy).toBe(200)
    expect(t.qoq_delta_pct).toBe(50)
    expect(t.yoy_delta_pct).toBe(200)
  })

  test('null comparison series yields null deltas', () => {
    const t = buildMetricTriple({
      current: [100],
      qoq: null,
      yoy: null,
    })
    expect(t.qoq).toBe(null)
    expect(t.yoy).toBe(null)
    expect(t.qoq_delta_pct).toBe(null)
    expect(t.yoy_delta_pct).toBe(null)
  })

  test('zero prior value yields null delta rather than divide-by-zero', () => {
    const t = buildMetricTriple({
      current: [100],
      qoq: [0],
      yoy: [0],
    })
    expect(t.qoq).toBe(0)
    expect(t.yoy).toBe(0)
    expect(t.qoq_delta_pct).toBe(null)
    expect(t.yoy_delta_pct).toBe(null)
  })

  test('empty comparison series sums to zero and returns null delta', () => {
    const t = buildMetricTriple({
      current: [100],
      qoq: [],
      yoy: [],
    })
    expect(t.qoq).toBe(0)
    expect(t.qoq_delta_pct).toBe(null)
  })

  test('rounds delta percentages to one decimal place', () => {
    const t = buildMetricTriple({
      current: [105],
      qoq: [97],
      yoy: null,
    })
    // (105 - 97) / 97 * 100 = 8.2474... → 8.2
    expect(t.qoq_delta_pct).toBe(8.2)
  })

  test('handles negative deltas when current is lower than prior', () => {
    const t = buildMetricTriple({
      current: [50],
      qoq: [100],
      yoy: null,
    })
    expect(t.qoq_delta_pct).toBe(-50)
  })
})
