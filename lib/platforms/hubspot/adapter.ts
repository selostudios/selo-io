// lib/platforms/hubspot/adapter.ts
import { HubSpotClient } from './client'
import type { HubSpotCredentials, HubSpotMetrics } from './types'

export class HubSpotAdapter {
  private client: HubSpotClient

  constructor(credentials: HubSpotCredentials, connectionId?: string) {
    this.client = new HubSpotClient(credentials, connectionId)
  }

  async fetchMetrics(): Promise<HubSpotMetrics> {
    return this.client.getMetrics()
  }

  normalizeToDbRecords(
    metrics: HubSpotMetrics,
    organizationId: string,
    date: Date
  ): Array<{
    organization_id: string
    platform_type: string
    metric_name: string
    metric_value: number
    date: string
  }> {
    const dateStr = date.toISOString().split('T')[0]

    return [
      // CRM metrics
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'total_contacts',
        metric_value: metrics.crm.totalContacts,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'total_deals',
        metric_value: metrics.crm.totalDeals,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'total_pipeline_value',
        metric_value: metrics.crm.totalPipelineValue,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'deals_won',
        metric_value: metrics.crm.dealsWon,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'deals_lost',
        metric_value: metrics.crm.dealsLost,
        date: dateStr,
      },
      // Marketing metrics
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'emails_sent',
        metric_value: metrics.marketing.emailsSent,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'emails_opened',
        metric_value: metrics.marketing.emailsOpened,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'emails_clicked',
        metric_value: metrics.marketing.emailsClicked,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'email_open_rate',
        metric_value: metrics.marketing.openRate,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'email_click_rate',
        metric_value: metrics.marketing.clickRate,
        date: dateStr,
      },
      {
        organization_id: organizationId,
        platform_type: 'hubspot',
        metric_name: 'form_submissions',
        metric_value: metrics.marketing.formSubmissions,
        date: dateStr,
      },
    ]
  }
}
