import { GoogleAnalyticsClient } from './client'
import type {
  GoogleAnalyticsCredentials,
  GoogleAnalyticsMetrics,
  GoogleAnalyticsDailyMetrics,
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

  /**
   * Fetch daily metrics for a date range.
   * Returns one GoogleAnalyticsDailyMetrics per day.
   */
  async fetchDailyMetrics(startDate: Date, endDate: Date): Promise<GoogleAnalyticsDailyMetrics[]> {
    return this.client.fetchDailyMetrics(startDate, endDate)
  }

  /**
   * Convert daily metrics to database records.
   * Each day gets 8 metric records (activeUsers, newUsers, sessions, 5 traffic sources).
   */
  normalizeDailyMetricsToDbRecords(
    dailyMetrics: GoogleAnalyticsDailyMetrics[],
    organizationId: string
  ): MetricRecord[] {
    const records: MetricRecord[] = []

    for (const dayMetrics of dailyMetrics) {
      records.push(
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_active_users',
          value: dayMetrics.activeUsers,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_new_users',
          value: dayMetrics.newUsers,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_sessions',
          value: dayMetrics.sessions,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_traffic_direct',
          value: dayMetrics.trafficAcquisition.direct,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_traffic_organic_search',
          value: dayMetrics.trafficAcquisition.organicSearch,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_traffic_email',
          value: dayMetrics.trafficAcquisition.email,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_traffic_organic_social',
          value: dayMetrics.trafficAcquisition.organicSocial,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'google_analytics',
          date: dayMetrics.date,
          metric_type: 'ga_traffic_referral',
          value: dayMetrics.trafficAcquisition.referral,
        }
      )
    }

    return records
  }

  /**
   * @deprecated Use normalizeDailyMetricsToDbRecords instead
   */
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
