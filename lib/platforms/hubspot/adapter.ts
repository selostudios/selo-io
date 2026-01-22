// lib/platforms/hubspot/adapter.ts
import { HubSpotClient } from './client'
import type { HubSpotCredentials, HubSpotMetrics } from './types'

interface MetricRecord {
  organization_id: string
  campaign_id: null
  platform_type: 'hubspot'
  date: string
  metric_type: string
  value: number
}

export class HubSpotAdapter {
  private client: HubSpotClient

  constructor(credentials: HubSpotCredentials, connectionId?: string) {
    this.client = new HubSpotClient(credentials, connectionId)
  }

  async fetchMetrics(startDate?: Date, endDate?: Date, days: number = 30): Promise<HubSpotMetrics> {
    return this.client.getMetrics(startDate, endDate, days)
  }

  normalizeToDbRecords(
    metrics: HubSpotMetrics,
    organizationId: string,
    date: Date
  ): MetricRecord[] {
    const dateStr = date.toISOString().split('T')[0]

    return [
      // CRM metrics
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_total_contacts',
        value: metrics.crm.totalContacts,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_total_deals',
        value: metrics.crm.totalDeals,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_new_deals',
        value: metrics.crm.newDeals,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_total_pipeline_value',
        value: metrics.crm.totalPipelineValue,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_deals_won',
        value: metrics.crm.dealsWon,
      },
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_deals_lost',
        value: metrics.crm.dealsLost,
      },
      // Marketing metrics
      {
        organization_id: organizationId,
        campaign_id: null,
        platform_type: 'hubspot',
        date: dateStr,
        metric_type: 'hubspot_form_submissions',
        value: metrics.marketing.formSubmissions,
      },
    ]
  }
}
