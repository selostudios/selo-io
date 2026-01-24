'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2, ChevronDown, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MetricCard } from './metric-card'
import { GoogleAnalyticsIcon } from '@/components/icons/platform-icons'
import { getGoogleAnalyticsMetrics } from '@/lib/platforms/google-analytics/actions'
import { cn } from '@/lib/utils'
import type { TrafficAcquisition } from '@/lib/platforms/google-analytics/types'
import type { Period } from './integrations-panel'
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

function formatChange(change: number | null): string {
  if (change === null) return ''
  const sign = change >= 0 ? '+' : ''
  return ` (${sign}${change.toFixed(1)}%)`
}

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

function getConnectionLabel(connection: Connection): string {
  return connection.display_name || connection.account_name || 'Unknown Account'
}

interface ConnectionMetricsProps {
  connection: Connection
  period: Period
  showHeader: boolean
  onMetricsLoaded?: (metrics: GAMetrics) => void
}

function ConnectionMetrics({
  connection,
  period,
  showHeader,
  onMetricsLoaded,
}: ConnectionMetricsProps) {
  const [metrics, setMetrics] = useState<GAMetrics | null>(null)
  const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([])
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const result = await getGoogleAnalyticsMetrics(period, connection.id)
      if ('metrics' in result && result.metrics) {
        setMetrics(result.metrics)
        onMetricsLoaded?.(result.metrics)
      }
      if ('timeSeries' in result && result.timeSeries) {
        setTimeSeries(result.timeSeries)
      }
    })
  }, [period, connection.id, onMetricsLoaded])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (metrics) {
      const text = formatMetricsForClipboard(metrics, period)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Helper to find time series data for a metric by label
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-sm font-medium">
            {getConnectionLabel(connection)}
          </h4>
          {metrics && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1.5 transition-colors"
                  aria-label="Copy metrics to clipboard"
                >
                  {copied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy metrics'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      {isPending ? (
        <div className="flex h-[100px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : metrics ? (
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
      ) : (
        <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
      )}
    </div>
  )
}

export function GoogleAnalyticsSection({ connections, period }: GoogleAnalyticsSectionProps) {
  const [singleMetrics, setSingleMetrics] = useState<GAMetrics | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopySingle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (singleMetrics) {
      const text = formatMetricsForClipboard(singleMetrics, period)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Not connected state
  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GoogleAnalyticsIcon className="size-5 text-[#E37400]" />
              <div>
                <CardTitle>Google Analytics</CardTitle>
                <CardDescription className="mt-1">
                  Connect Google Analytics to view website traffic metrics.
                </CardDescription>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/settings/integrations">Connect</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  // Single connection: no account header needed, but show copy button in main header
  if (connections.length === 1) {
    return (
      <Collapsible defaultOpen className="group/section rounded-lg border p-4">
        <div className="flex items-center justify-between py-2">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
            <ChevronDown
              className={cn(
                'text-muted-foreground size-5 transition-transform duration-200',
                'group-data-[state=closed]/section:-rotate-90'
              )}
            />
            <GoogleAnalyticsIcon className="size-5 text-[#E37400]" />
            <span className="text-lg font-semibold">Google Analytics</span>
          </CollapsibleTrigger>
          {singleMetrics && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopySingle}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1.5 transition-colors"
                  aria-label="Copy metrics to clipboard"
                >
                  {copied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy metrics'}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <CollapsibleContent className="mt-4">
          <ConnectionMetrics
            connection={connections[0]}
            period={period}
            showHeader={false}
            onMetricsLoaded={setSingleMetrics}
          />
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // Multiple connections: show sub-sections with account headers
  return (
    <Collapsible defaultOpen className="group/section rounded-lg border p-4">
      <div className="flex items-center justify-between py-2">
        <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/section:-rotate-90'
            )}
          />
          <GoogleAnalyticsIcon className="size-5 text-[#E37400]" />
          <span className="text-lg font-semibold">Google Analytics</span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-4 space-y-8">
        {connections.map((connection) => (
          <ConnectionMetrics
            key={connection.id}
            connection={connection}
            period={period}
            showHeader={true}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
