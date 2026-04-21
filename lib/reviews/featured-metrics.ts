export type MetricFormat = 'number' | 'percent'

export interface FeaturedMetric {
  key: string // matches SnapshotData.ga[key]
  label: string // card label, e.g. "Sessions"
  format: MetricFormat
}

export const GA_FEATURED_METRICS: readonly FeaturedMetric[] = [
  { key: 'ga_sessions', label: 'Sessions', format: 'number' },
  { key: 'ga_active_users', label: 'Active users', format: 'number' },
  // If ga_engagement_rate exists in campaign_metrics, swap to:
  //   { key: 'ga_engagement_rate', label: 'Engagement rate', format: 'percent' },
  // Otherwise keep new_users as the third metric:
  { key: 'ga_new_users', label: 'New users', format: 'number' },
] as const

export const GA_FEATURED_METRIC_KEYS: readonly string[] = GA_FEATURED_METRICS.map((m) => m.key)
