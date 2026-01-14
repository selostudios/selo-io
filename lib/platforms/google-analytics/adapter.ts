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
        metric_type: 'ga_active_users',
        value: metrics.activeUsers,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_new_users',
        value: metrics.newUsers,
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
        metric_type: 'ga_traffic_direct',
        value: metrics.trafficAcquisition.direct,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_traffic_organic_search',
        value: metrics.trafficAcquisition.organicSearch,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_traffic_email',
        value: metrics.trafficAcquisition.email,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_traffic_organic_social',
        value: metrics.trafficAcquisition.organicSocial,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'google_analytics',
        date: dateStr,
        metric_type: 'ga_traffic_referral',
        value: metrics.trafficAcquisition.referral,
      },
    ]
  }
}
