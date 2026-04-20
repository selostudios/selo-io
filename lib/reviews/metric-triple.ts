import type { MetricTriple } from '@/lib/reviews/types'

export interface MetricTripleInput {
  current: number[]
  qoq: number[] | null
  yoy: number[] | null
}

export function buildMetricTriple(input: MetricTripleInput): MetricTriple {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const current = sum(input.current)
  const qoq = input.qoq ? sum(input.qoq) : null
  const yoy = input.yoy ? sum(input.yoy) : null
  const deltaPct = (prior: number | null): number | null => {
    if (prior === null || prior === 0) return null
    return Math.round(((current - prior) / prior) * 100 * 10) / 10
  }
  return {
    current,
    qoq,
    yoy,
    qoq_delta_pct: deltaPct(qoq),
    yoy_delta_pct: deltaPct(yoy),
  }
}
