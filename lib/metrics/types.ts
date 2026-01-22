export type Period = '7d' | '30d' | 'quarter'

export interface TimeSeriesDataPoint {
  date: string // YYYY-MM-DD
  value: number
}

export interface MetricTimeSeries {
  metricType: string
  label: string
  data: TimeSeriesDataPoint[]
}

export interface MetricRecord {
  date: string
  metric_type: string
  value: number
}

export interface CachedMetricsResult {
  metrics: MetricRecord[]
  isFresh: boolean // true if < 1 hour old
  lastSyncAt: string | null
}

export interface DateRanges {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
}

// Platform-specific metric types for time series
export const LINKEDIN_METRICS = [
  { metricType: 'linkedin_follower_growth', label: 'New Followers' },
  { metricType: 'linkedin_impressions', label: 'Impressions' },
  { metricType: 'linkedin_reactions', label: 'Reactions' },
  { metricType: 'linkedin_page_views', label: 'Page Views' },
  { metricType: 'linkedin_unique_visitors', label: 'Unique Visitors' },
] as const

export const GA_METRICS = [
  { metricType: 'ga_active_users', label: 'Active Users' },
  { metricType: 'ga_new_users', label: 'New Users' },
  { metricType: 'ga_sessions', label: 'Sessions' },
  { metricType: 'ga_traffic_direct', label: 'Direct Traffic' },
  { metricType: 'ga_traffic_organic_search', label: 'Organic Search' },
  { metricType: 'ga_traffic_email', label: 'Email Traffic' },
  { metricType: 'ga_traffic_organic_social', label: 'Organic Social' },
  { metricType: 'ga_traffic_referral', label: 'Referral Traffic' },
] as const

export const HUBSPOT_METRICS = [
  { metricType: 'hubspot_total_contacts', label: 'Total Contacts' },
  { metricType: 'hubspot_total_deals', label: 'Total Deals' },
  { metricType: 'hubspot_new_deals', label: 'New Deals' },
  { metricType: 'hubspot_total_pipeline_value', label: 'Pipeline Value' },
  { metricType: 'hubspot_deals_won', label: 'Deals Won' },
  { metricType: 'hubspot_deals_lost', label: 'Deals Lost' },
  { metricType: 'hubspot_form_submissions', label: 'Form Submissions' },
] as const
