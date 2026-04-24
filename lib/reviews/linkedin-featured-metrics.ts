import { MetricFormat } from '@/lib/enums'

export type LinkedInFeaturedMetricKey =
  | 'linkedin_impressions'
  | 'linkedin_follower_growth'
  | 'linkedin_page_views'

export interface LinkedInFeaturedMetric {
  key: LinkedInFeaturedMetricKey
  label: string
  format: MetricFormat
}

export const LINKEDIN_FEATURED_METRICS = [
  { key: 'linkedin_impressions', label: 'Impressions', format: MetricFormat.Number },
  { key: 'linkedin_follower_growth', label: 'New followers', format: MetricFormat.Number },
  { key: 'linkedin_page_views', label: 'Page views', format: MetricFormat.Number },
] as const satisfies readonly LinkedInFeaturedMetric[]

export const LINKEDIN_FEATURED_METRIC_KEYS: readonly LinkedInFeaturedMetricKey[] =
  LINKEDIN_FEATURED_METRICS.map((m) => m.key)

const FEATURED_SET = new Set<string>(LINKEDIN_FEATURED_METRIC_KEYS)

export function isFeaturedLinkedInMetric(key: string): boolean {
  return FEATURED_SET.has(key)
}
