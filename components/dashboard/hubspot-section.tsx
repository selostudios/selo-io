'use client'

import { MetricCard } from './metric-card'
import { HubSpotIcon } from '@/components/icons/platform-icons'
import { getHubSpotMetrics } from '@/lib/platforms/hubspot/actions'
import { PlatformSection, formatChange } from './platform-section'
import { Period } from '@/lib/enums'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface HubSpotMetricsWithChanges {
  crm: {
    totalContacts: number
    totalDeals: number
    newDeals: number
    totalPipelineValue: number
    dealsWon: number
    dealsLost: number
    newDealsChange: number | null
    dealsWonChange: number | null
    dealsLostChange: number | null
  }
  marketing: {
    formSubmissions: number
    formSubmissionsChange: number | null
  }
}

type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

interface HubSpotSectionProps {
  connections: Connection[]
  period: Period
}

const HUBSPOT_COLOR = '#FF7A59'

function formatMetricsForClipboard(
  metrics: HubSpotMetricsWithChanges,
  period: Period,
  accountLabel?: string
): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const header = accountLabel
    ? `HubSpot - ${accountLabel} (${periodLabel})`
    : `HubSpot Metrics (${periodLabel})`
  const lines = [
    header,
    '',
    '-- Deals --',
    `* New Deals: ${metrics.crm.newDeals.toLocaleString()}${formatChange(metrics.crm.newDealsChange)}`,
    `* Deals Won: ${metrics.crm.dealsWon.toLocaleString()}${formatChange(metrics.crm.dealsWonChange)}`,
    `* Deals Lost: ${metrics.crm.dealsLost.toLocaleString()}${formatChange(metrics.crm.dealsLostChange)}`,
    `* Total Deals: ${metrics.crm.totalDeals.toLocaleString()}`,
    '',
    '-- Other --',
    `* Total Contacts: ${metrics.crm.totalContacts.toLocaleString()}`,
    `* Pipeline Value: $${metrics.crm.totalPipelineValue.toLocaleString()}`,
    `* Form Submissions: ${metrics.marketing.formSubmissions.toLocaleString()}${formatChange(metrics.marketing.formSubmissionsChange)}`,
  ]
  return lines.join('\n')
}

async function fetchHubSpotMetrics(connectionId: string, period: Period) {
  const result = await getHubSpotMetrics(period, connectionId)
  return {
    metrics: 'metrics' in result ? result.metrics : undefined,
    timeSeries: 'timeSeries' in result ? result.timeSeries : undefined,
  }
}

function renderHubSpotMetrics(
  metrics: HubSpotMetricsWithChanges,
  timeSeries: MetricTimeSeries[],
  period: Period
) {
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <MetricCard
        label="New Deals"
        value={metrics.crm.newDeals}
        change={metrics.crm.newDealsChange}
        tooltip="Deals created during this period."
        period={period}
        timeSeries={getTimeSeriesForMetric('New Deals')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Deals Won"
        value={metrics.crm.dealsWon}
        change={metrics.crm.dealsWonChange}
        tooltip="Deals closed as won during this period."
        period={period}
        timeSeries={getTimeSeriesForMetric('Deals Won')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Deals Lost"
        value={metrics.crm.dealsLost}
        change={metrics.crm.dealsLostChange}
        tooltip="Deals closed as lost during this period."
        period={period}
        timeSeries={getTimeSeriesForMetric('Deals Lost')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Total Deals"
        value={metrics.crm.totalDeals}
        change={null}
        tooltip="Total number of deals in your CRM."
        period={period}
        timeSeries={getTimeSeriesForMetric('Total Deals')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Total Contacts"
        value={metrics.crm.totalContacts}
        change={null}
        tooltip="Total number of contacts in your HubSpot CRM."
        period={period}
        timeSeries={getTimeSeriesForMetric('Total Contacts')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Pipeline Value"
        value={metrics.crm.totalPipelineValue}
        prefix="$"
        change={null}
        tooltip="Combined value of all deals currently in your pipeline."
        period={period}
        timeSeries={getTimeSeriesForMetric('Pipeline Value')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Form Submissions"
        value={metrics.marketing.formSubmissions}
        change={metrics.marketing.formSubmissionsChange}
        tooltip="Total form submissions across all HubSpot forms."
        period={period}
        timeSeries={getTimeSeriesForMetric('Form Submissions')}
        color={HUBSPOT_COLOR}
      />
    </div>
  )
}

export function HubSpotSection({ connections, period }: HubSpotSectionProps) {
  return (
    <PlatformSection<HubSpotMetricsWithChanges>
      connections={connections}
      period={period}
      config={{
        name: 'HubSpot',
        color: HUBSPOT_COLOR,
        icon: <HubSpotIcon className="size-5 text-[#FF7A59]" />,
        connectHref: '/api/auth/oauth/hubspot',
        connectDescription: 'Connect HubSpot to view CRM metrics and form submissions.',
      }}
      getMetrics={fetchHubSpotMetrics}
      formatMetricsForClipboard={formatMetricsForClipboard}
      renderMetrics={renderHubSpotMetrics}
    />
  )
}
