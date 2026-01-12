// Google Analytics credentials stored in platform_connections
export interface GoogleAnalyticsCredentials {
  access_token: string
  refresh_token: string
  expires_at: string // ISO 8601
  property_id: string // e.g., "properties/123456789"
  property_name: string
}

// Metrics returned from GA4 Data API
export interface GoogleAnalyticsMetrics {
  users: number
  sessions: number
  pageViews: number
}

// Metric types stored in campaign_metrics table
export type GoogleAnalyticsMetricType =
  | 'ga_users'
  | 'ga_sessions'
  | 'ga_page_views'

export const GA_METRIC_TYPES: GoogleAnalyticsMetricType[] = [
  'ga_users',
  'ga_sessions',
  'ga_page_views',
]
