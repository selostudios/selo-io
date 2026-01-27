import { LinkedInClient } from './client'
import type {
  LinkedInCredentials,
  LinkedInMetrics,
  LinkedInDailyMetrics,
  LinkedInMetricType,
} from './types'

interface MetricRecord {
  organization_id: string
  campaign_id: null
  platform_type: 'linkedin'
  date: string
  metric_type: LinkedInMetricType
  value: number
}

export class LinkedInAdapter {
  private client: LinkedInClient

  constructor(credentials: LinkedInCredentials, connectionId?: string) {
    this.client = new LinkedInClient(credentials, connectionId)
  }

  async fetchMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    return this.client.getAllMetrics(startDate, endDate)
  }

  async fetchDailyMetrics(startDate: Date, endDate: Date): Promise<LinkedInDailyMetrics[]> {
    return this.client.fetchDailyMetrics(startDate, endDate)
  }

  normalizeToDbRecords(
    metrics: LinkedInMetrics,
    organizationId: string,
    date: Date
  ): MetricRecord[] {
    const dateStr = date.toISOString().split('T')[0]

    return [
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_followers',
        value: metrics.followers,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_follower_growth',
        value: metrics.followerGrowth,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_page_views',
        value: metrics.pageViews,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_unique_visitors',
        value: metrics.uniqueVisitors,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_impressions',
        value: metrics.impressions,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: dateStr,
        metric_type: 'linkedin_reactions',
        value: metrics.reactions,
      },
    ]
  }

  normalizeDailyMetricsToDbRecords(
    dailyMetrics: LinkedInDailyMetrics[],
    organizationId: string
  ): MetricRecord[] {
    const records: MetricRecord[] = []

    for (const day of dailyMetrics) {
      records.push(
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_followers',
          value: day.followers,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_follower_growth',
          value: day.followerGrowth,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_page_views',
          value: day.pageViews,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_unique_visitors',
          value: day.uniqueVisitors,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_impressions',
          value: day.impressions,
        },
        {
          organization_id: organizationId,
          campaign_id: null,
          platform_type: 'linkedin',
          date: day.date,
          metric_type: 'linkedin_reactions',
          value: day.reactions,
        }
      )
    }

    return records
  }
}
