'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2, ChevronDown, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PlatformSectionProps, PlatformConnection } from './types'
import { getConnectionLabel } from './types'
import { Period } from '@/lib/enums'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface ConnectionMetricsProps<TMetrics> {
  connection: PlatformConnection
  period: Period
  getMetrics: PlatformSectionProps<TMetrics>['getMetrics']
  renderMetrics: PlatformSectionProps<TMetrics>['renderMetrics']
  onMetricsLoaded?: (metrics: TMetrics) => void
}

function ConnectionMetrics<TMetrics>({
  connection,
  period,
  getMetrics,
  renderMetrics,
  onMetricsLoaded,
}: ConnectionMetricsProps<TMetrics>) {
  const [metrics, setMetrics] = useState<TMetrics | null>(null)
  const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getMetrics(connection.id, period)
      if (result.metrics) {
        setMetrics(result.metrics)
        onMetricsLoaded?.(result.metrics)
      }
      if (result.timeSeries) {
        setTimeSeries(result.timeSeries)
      }
    })
  }, [connection.id, period, getMetrics, onMetricsLoaded])

  if (isPending) {
    return (
      <div className="flex h-[100px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!metrics) {
    return <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
  }

  return <>{renderMetrics(metrics, timeSeries, period)}</>
}

export function PlatformSection<TMetrics>({
  connections,
  period,
  config,
  getMetrics,
  formatMetricsForClipboard,
  renderMetrics,
}: PlatformSectionProps<TMetrics>) {
  const [singleMetrics, setSingleMetrics] = useState<TMetrics | null>(null)
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
              {config.icon}
              <div>
                <CardTitle>{config.name}</CardTitle>
                <CardDescription className="mt-1">{config.connectDescription}</CardDescription>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={config.connectHref}>Connect</Link>
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
            {config.icon}
            <span className="text-lg font-semibold">{config.name}</span>
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
            getMetrics={getMetrics}
            renderMetrics={renderMetrics}
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
          {config.icon}
          <span className="text-lg font-semibold">{config.name}</span>
          <span className="text-muted-foreground text-sm">({connections.length} accounts)</span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-4 space-y-6">
        {connections.map((connection) => (
          <div key={connection.id} className="space-y-3">
            <h4 className="text-muted-foreground text-sm font-medium">
              {getConnectionLabel(connection)}
            </h4>
            <ConnectionMetrics
              connection={connection}
              period={period}
              getMetrics={getMetrics}
              renderMetrics={renderMetrics}
            />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
