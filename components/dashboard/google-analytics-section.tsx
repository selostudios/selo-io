'use client'

import { MetricCard } from './metric-card'
import { GoogleAnalyticsIcon } from '@/components/icons/platform-icons'
import { getGoogleAnalyticsMetrics } from '@/lib/platforms/google-analytics/actions'
import { PlatformSection, formatChange } from './platform-section'
import type { TrafficAcquisition } from '@/lib/platforms/google-analytics/types'
import { Period } from '@/lib/enums'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface GAMetrics {
  activeUsers: number
  activeUsersChange: number | null
  newUsers: number
  newUsersChange: number | null
  sessions: number
  sessionsChange: number | null
  trafficAcquisition: TrafficAcquisition
  trafficAcquisitionChanges: {
    direct: number | null
    organicSearch: number | null
    email: number | null
    organicSocial: number | null
    referral: number | null
  }
}

type Connection = {
  id: string
  account_name: string | null
  display_name: string | null
}

interface GoogleAnalyticsSectionProps {
  connections: Connection[]
  period: Period
}

const GA_COLOR = '#E37400'

function formatMetricsForClipboard(metrics: GAMetrics, period: Period): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const lines = [
    `📈 Google Analytics (${periodLabel})`,
    '',
    '**Overview**',
    `• Active Users: ${metrics.activeUsers.toLocaleString()}${formatChange(metrics.activeUsersChange)}`,
    `• New Users: ${metrics.newUsers.toLocaleString()}${formatChange(metrics.newUsersChange)}`,
    `• Sessions: ${metrics.sessions.toLocaleString()}${formatChange(metrics.sessionsChange)}`,
    '',
    '**Traffic Acquisition**',
    `• Direct: ${metrics.trafficAcquisition.direct.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.direct)}`,
    `• Organic Search: ${metrics.trafficAcquisition.organicSearch.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.organicSearch)}`,
    `• Email: ${metrics.trafficAcquisition.email.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.email)}`,
    `• Organic Social: ${metrics.trafficAcquisition.organicSocial.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.organicSocial)}`,
    `• Referral: ${metrics.trafficAcquisition.referral.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.referral)}`,
  ]
  return lines.join('\n')
}

async function fetchGAMetrics(connectionId: string, period: Period) {
  const result = await getGoogleAnalyticsMetrics(period, connectionId)
  return {
    metrics: 'metrics' in result ? result.metrics : undefined,
    timeSeries: 'timeSeries' in result ? result.timeSeries : undefined,
  }
}

function renderGAMetrics(metrics: GAMetrics, timeSeries: MetricTimeSeries[], period: Period) {
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="space-y-6">
      {/* Main metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard
          label="Active Users"
          value={metrics.activeUsers}
          change={metrics.activeUsersChange}
          period={period}
          timeSeries={getTimeSeriesForMetric('Active Users')}
          color={GA_COLOR}
          tooltip="The number of distinct users who engaged with your site during this period."
        />
        <MetricCard
          label="New Users"
          value={metrics.newUsers}
          change={metrics.newUsersChange}
          period={period}
          timeSeries={getTimeSeriesForMetric('New Users')}
          color={GA_COLOR}
        />
        <MetricCard
          label="Sessions"
          value={metrics.sessions}
          change={metrics.sessionsChange}
          period={period}
          timeSeries={getTimeSeriesForMetric('Sessions')}
          color={GA_COLOR}
        />
      </div>

      {/* Traffic Acquisition */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Traffic Acquisition</h4>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Direct"
            value={metrics.trafficAcquisition.direct}
            change={metrics.trafficAcquisitionChanges.direct}
            period={period}
            timeSeries={getTimeSeriesForMetric('Direct')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Organic Search"
            value={metrics.trafficAcquisition.organicSearch}
            change={metrics.trafficAcquisitionChanges.organicSearch}
            period={period}
            timeSeries={getTimeSeriesForMetric('Organic Search')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Email"
            value={metrics.trafficAcquisition.email}
            change={metrics.trafficAcquisitionChanges.email}
            period={period}
            timeSeries={getTimeSeriesForMetric('Email')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Organic Social"
            value={metrics.trafficAcquisition.organicSocial}
            change={metrics.trafficAcquisitionChanges.organicSocial}
            period={period}
            timeSeries={getTimeSeriesForMetric('Organic Social')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Referral"
            value={metrics.trafficAcquisition.referral}
            change={metrics.trafficAcquisitionChanges.referral}
            period={period}
            timeSeries={getTimeSeriesForMetric('Referral')}
            color={GA_COLOR}
          />
        </div>
      </div>
    </div>
  )
}

export function GoogleAnalyticsSection({ connections, period }: GoogleAnalyticsSectionProps) {
  return (
    <PlatformSection<GAMetrics>
      connections={connections}
      period={period}
      config={{
        name: 'Google Analytics',
        color: GA_COLOR,
        icon: <GoogleAnalyticsIcon className="size-5 text-[#E37400]" />,
        connectHref: '/api/auth/oauth/google_analytics',
        connectDescription: 'Connect Google Analytics to view website traffic metrics.',
      }}
      getMetrics={fetchGAMetrics}
      formatMetricsForClipboard={formatMetricsForClipboard}
      renderMetrics={renderGAMetrics}
    />
  )
}
