import { MetricFormat } from '@/lib/enums'
import type { GaMetricKey } from '@/lib/reviews/fetchers/ga'

export interface FeaturedMetric {
  key: GaMetricKey
  label: string
  format: MetricFormat
}

export const GA_FEATURED_METRICS = [
  { key: 'ga_sessions', label: 'Sessions', format: MetricFormat.Number },
  { key: 'ga_active_users', label: 'Active users', format: MetricFormat.Number },
  // TODO(ga-engagement-rate): If ga_engagement_rate lands in campaign_metrics, swap this
  // row to { key: 'ga_engagement_rate', label: 'Engagement rate', format: MetricFormat.Percent }.
  { key: 'ga_new_users', label: 'New users', format: MetricFormat.Number },
] as const satisfies readonly FeaturedMetric[]

export const GA_FEATURED_METRIC_KEYS: readonly GaMetricKey[] = GA_FEATURED_METRICS.map((m) => m.key)

const FEATURED_SET = new Set<string>(GA_FEATURED_METRIC_KEYS)

export function isFeaturedGaMetric(key: string): boolean {
  return FEATURED_SET.has(key)
}
