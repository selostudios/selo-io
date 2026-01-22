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

interface GAMetrics {
  activeUsers: number
  newUsers: number
  sessions: number
  trafficAcquisition: TrafficAcquisition
}

interface GoogleAnalyticsSectionProps {
  isConnected: boolean
  period: Period
}

function formatMetricsForClipboard(metrics: GAMetrics, period: Period): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const lines = [
    `📈 Google Analytics (${periodLabel})`,
    '',
    '**Overview**',
    `• Active Users: ${metrics.activeUsers.toLocaleString()}`,
    `• New Users: ${metrics.newUsers.toLocaleString()}`,
    `• Sessions: ${metrics.sessions.toLocaleString()}`,
    '',
    '**Traffic Acquisition**',
    `• Direct: ${metrics.trafficAcquisition.direct.toLocaleString()}`,
    `• Organic Search: ${metrics.trafficAcquisition.organicSearch.toLocaleString()}`,
    `• Email: ${metrics.trafficAcquisition.email.toLocaleString()}`,
    `• Organic Social: ${metrics.trafficAcquisition.organicSocial.toLocaleString()}`,
    `• Referral: ${metrics.trafficAcquisition.referral.toLocaleString()}`,
  ]
  return lines.join('\n')
}

export function GoogleAnalyticsSection({ isConnected, period }: GoogleAnalyticsSectionProps) {
  const [metrics, setMetrics] = useState<GAMetrics | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getGoogleAnalyticsMetrics(period)
        if (result.metrics) {
          setMetrics(result.metrics)
        }
      })
    }
  }, [isConnected, period])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (metrics) {
      const text = formatMetricsForClipboard(metrics, period)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isConnected) {
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

  return (
    <Collapsible defaultOpen className="group/section rounded-lg border py-4">
      <div className="bg-background flex items-center justify-between rounded-md px-4 py-3">
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
        {metrics && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1.5 transition-colors"
                aria-label="Copy metrics to clipboard"
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied!' : 'Copy metrics'}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <CollapsibleContent className="mt-4">
        {isPending ? (
          <div className="flex h-[100px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Main metrics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="Active Users" value={metrics.activeUsers} change={null} />
              <MetricCard label="New Users" value={metrics.newUsers} change={null} />
              <MetricCard label="Sessions" value={metrics.sessions} change={null} />
            </div>

            {/* Traffic Acquisition */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Traffic Acquisition</h4>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                <MetricCard
                  label="Direct"
                  value={metrics.trafficAcquisition.direct}
                  change={null}
                />
                <MetricCard
                  label="Organic Search"
                  value={metrics.trafficAcquisition.organicSearch}
                  change={null}
                />
                <MetricCard label="Email" value={metrics.trafficAcquisition.email} change={null} />
                <MetricCard
                  label="Organic Social"
                  value={metrics.trafficAcquisition.organicSocial}
                  change={null}
                />
                <MetricCard
                  label="Referral"
                  value={metrics.trafficAcquisition.referral}
                  change={null}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
