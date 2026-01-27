'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2, ChevronDown, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MetricCard } from './metric-card'
import { LinkedInIcon } from '@/components/icons/platform-icons'
import { getLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import { cn } from '@/lib/utils'
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

function getConnectionLabel(connection: Connection): string {
  return connection.display_name || connection.account_name || 'Unknown Account'
}

function formatChange(change: number | null): string {
  if (change === null) return ''
  const sign = change >= 0 ? '+' : ''
  return ` (${sign}${change.toFixed(1)}%)`
}

function formatMetricsForClipboard(
  metrics: Metric[],
  period: Period,
  accountName?: string
): string {
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

export function LinkedInSection({ connections, period }: LinkedInSectionProps) {
  const [singleMetrics, setSingleMetrics] = useState<Metric[]>([])
  const [copied, setCopied] = useState(false)

  const handleCopySingle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (singleMetrics.length > 0) {
      const text = formatMetricsForClipboard(singleMetrics, period)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LinkedInIcon className="size-5 text-[#0A66C2]" />
              <div>
                <CardTitle>LinkedIn</CardTitle>
                <CardDescription className="mt-1">
                  Connect LinkedIn to view engagement metrics.
                </CardDescription>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/api/auth/oauth/linkedin">Connect</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  // Single connection: render without account header, copy button in main header
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
            <LinkedInIcon className="size-5 text-[#0A66C2]" />
            <span className="text-lg font-semibold">LinkedIn</span>
          </CollapsibleTrigger>
          {singleMetrics.length > 0 && (
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
            onMetricsLoaded={setSingleMetrics}
          />
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // Multiple connections: render sub-sections with headers
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
          <LinkedInIcon className="size-5 text-[#0A66C2]" />
          <span className="text-lg font-semibold">LinkedIn</span>
          <span className="text-muted-foreground text-sm">({connections.length} accounts)</span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-4 space-y-6">
        {connections.map((connection) => (
          <div key={connection.id} className="space-y-3">
            <h4 className="text-muted-foreground text-sm font-medium">
              {getConnectionLabel(connection)}
            </h4>
            <ConnectionMetrics connection={connection} period={period} />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ConnectionMetricsProps {
  connection: Connection
  period: Period
  onMetricsLoaded?: (metrics: Metric[]) => void
}

function ConnectionMetrics({ connection, period, onMetricsLoaded }: ConnectionMetricsProps) {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getLinkedInMetrics(period, connection.id)
      if ('metrics' in result && result.metrics) {
        setMetrics(result.metrics)
        onMetricsLoaded?.(result.metrics)
      }
      if ('timeSeries' in result && result.timeSeries) {
        setTimeSeries(result.timeSeries)
      }
    })
  }, [connection.id, period, onMetricsLoaded])

  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  if (isPending) {
    return (
      <div className="flex h-[100px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (metrics.length === 0) {
    return <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
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
