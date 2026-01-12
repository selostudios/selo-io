import { GoogleAnalyticsClient } from './client'
import type {
  GoogleAnalyticsCredentials,
  GoogleAnalyticsMetrics,
  GoogleAnalyticsMetricType,
} from './types'

interface MetricRecord {
  organization_id: string
  campaign_id: null
  platform_type: 'google_analytics'
  date: string
  metric_type: GoogleAnalyticsMetricType
  value: number
}

export class GoogleAnalyticsAdapter {
  private client: GoogleAnalyticsClient

  constructor(credentials: GoogleAnalyticsCredentials, connectionId?: string) {
    this.client = new GoogleAnalyticsClient(credentials, connectionId)
  }

  async fetchMetrics(startDate: Date, endDate: Date): Promise<GoogleAnalyticsMetrics> {
    return this.client.getMetrics(startDate, endDate)
  }

  normalizeToDbRecords(
    metrics: GoogleAnalyticsMetrics,
    organizationId: string,
    date: Date
  ): MetricRecord[] {
    const dateStr = date.toISOString().split('T')[0]

    return [
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_users',
        value: metrics.users,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_sessions',
        value: metrics.sessions,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_page_views',
        value: metrics.pageViews,
      },
    ]
  }
}
