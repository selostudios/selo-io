'use client'

import { MetricCard } from './metric-card'
import { LinkedInIcon } from '@/components/icons/platform-icons'
import { getLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import { PlatformSection, formatChange } from './platform-section'
import type { Period } from './integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface Metric {
  label: string
  value: number
  change: number | null
}

type Connection = {
  id: string
  account_name: string | null
  display_name: string | null
}

interface LinkedInSectionProps {
  connections: Connection[]
  period: Period
}

const LINKEDIN_COLOR = '#0A66C2'

function formatMetricsForClipboard(metrics: Metric[], period: Period, accountName?: string): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const header = accountName
    ? `📊 LinkedIn Metrics - ${accountName} (${periodLabel})`
    : `📊 LinkedIn Metrics (${periodLabel})`
  const lines = [header, '']
  for (const metric of metrics) {
    lines.push(`• ${metric.label}: ${metric.value.toLocaleString()}${formatChange(metric.change)}`)
  }
  return lines.join('\n')
}

async function fetchLinkedInMetrics(connectionId: string, period: Period) {
  const result = await getLinkedInMetrics(period, connectionId)
  return {
    metrics: 'metrics' in result ? result.metrics : undefined,
    timeSeries: 'timeSeries' in result ? result.timeSeries : undefined,
  }
}

function renderLinkedInMetrics(
  metrics: Metric[],
  timeSeries: MetricTimeSeries[],
  period: Period
) {
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          period={period}
          timeSeries={getTimeSeriesForMetric(metric.label)}
          color={LINKEDIN_COLOR}
        />
      ))}
    </div>
  )
}

export function LinkedInSection({ connections, period }: LinkedInSectionProps) {
  return (
    <PlatformSection<Metric[]>
      connections={connections}
      period={period}
      config={{
        name: 'LinkedIn',
        color: LINKEDIN_COLOR,
        icon: <LinkedInIcon className="size-5 text-[#0A66C2]" />,
        connectHref: '/api/auth/oauth/linkedin',
        connectDescription: 'Connect LinkedIn to view engagement metrics.',
      }}
      getMetrics={fetchLinkedInMetrics}
      formatMetricsForClipboard={formatMetricsForClipboard}
      renderMetrics={renderLinkedInMetrics}
    />
  )
}
