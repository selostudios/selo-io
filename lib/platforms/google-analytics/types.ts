// Google Analytics credentials stored in platform_connections
export interface GoogleAnalyticsCredentials {
  access_token: string
  refresh_token: string
  expires_at: string // ISO 8601
  property_id: string // e.g., "properties/123456789"
  property_name: string
}

// Traffic acquisition breakdown
export interface TrafficAcquisition {
  direct: number
  organicSearch: number
  email: number
  organicSocial: number
  referral: number
}

// Metrics returned from GA4 Data API
export interface GoogleAnalyticsMetrics {
  activeUsers: number
  newUsers: number
  sessions: number
  trafficAcquisition: TrafficAcquisition
}

// Metric types stored in campaign_metrics table
export type GoogleAnalyticsMetricType =
  | 'ga_active_users'
  | 'ga_new_users'
  | 'ga_sessions'
  | 'ga_traffic_direct'
  | 'ga_traffic_organic_search'
  | 'ga_traffic_email'
  | 'ga_traffic_organic_social'
  | 'ga_traffic_referral'

export const GA_METRIC_TYPES: GoogleAnalyticsMetricType[] = [
  'ga_active_users',
  'ga_new_users',
  'ga_sessions',
  'ga_traffic_direct',
  'ga_traffic_organic_search',
  'ga_traffic_email',
  'ga_traffic_organic_social',
  'ga_traffic_referral',
]
