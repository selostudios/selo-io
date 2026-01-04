import { LinkedInClient } from './client'
import type { LinkedInCredentials, LinkedInMetrics, LinkedInMetricType } from './types'

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

  constructor(credentials: LinkedInCredentials) {
    this.client = new LinkedInClient(credentials)
  }

  async fetchMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    return this.client.getAllMetrics(startDate, endDate)
  }

  normalizeToDbRecords(metrics: LinkedInMetrics, organizationId: string, date: Date): MetricRecord[] {
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
}
