import { MetricFormat } from '@/lib/enums'

const EM_DASH = '\u2014'

export function formatMetricValue(
  value: number | null,
  format: MetricFormat,
  nullFallback: string = EM_DASH
): string {
  if (value === null) return nullFallback
  if (format === MetricFormat.Percent) return `${Math.round(value)}%`
  return value.toLocaleString()
}

export function formatMetricDelta(delta: number | null, nullFallback: string = EM_DASH): string {
  if (delta === null) return nullFallback
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}
