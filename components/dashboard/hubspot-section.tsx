'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2, ChevronDown, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MetricCard } from './metric-card'
import { HubSpotIcon } from '@/components/icons/platform-icons'
import { getHubSpotMetrics } from '@/lib/platforms/hubspot/actions'
import { cn } from '@/lib/utils'
import type { Period } from './integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'

// Extended metrics type with change values from the actions
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

interface HubSpotSectionProps {
  isConnected: boolean
  period: Period
}

const HUBSPOT_COLOR = '#FF7A59'

function formatChange(change: number | null): string {
  if (change === null) return ''
  const sign = change >= 0 ? '+' : ''
  return ` (${sign}${change.toFixed(1)}%)`
}

function formatMetricsForClipboard(metrics: HubSpotMetricsWithChanges, period: Period): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const lines = [
    `🟠 HubSpot Metrics (${periodLabel})`,
    '',
    `• Total Contacts: ${metrics.crm.totalContacts.toLocaleString()}`,
    `• Total Deals: ${metrics.crm.totalDeals.toLocaleString()}`,
    `• New Deals: ${metrics.crm.newDeals.toLocaleString()}${formatChange(metrics.crm.newDealsChange)}`,
    `• Pipeline Value: $${metrics.crm.totalPipelineValue.toLocaleString()}`,
    `• Deals Won: ${metrics.crm.dealsWon.toLocaleString()}${formatChange(metrics.crm.dealsWonChange)}`,
    `• Deals Lost: ${metrics.crm.dealsLost.toLocaleString()}${formatChange(metrics.crm.dealsLostChange)}`,
    `• Form Submissions: ${metrics.marketing.formSubmissions.toLocaleString()}${formatChange(metrics.marketing.formSubmissionsChange)}`,
  ]
  return lines.join('\n')
}

export function HubSpotSection({ isConnected, period }: HubSpotSectionProps) {
  const [metrics, setMetrics] = useState<HubSpotMetricsWithChanges | null>(null)
  const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([])
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getHubSpotMetrics(period)
        if ('metrics' in result && result.metrics) {
          setMetrics(result.metrics)
        }
        if ('timeSeries' in result && result.timeSeries) {
          setTimeSeries(result.timeSeries)
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

  // Helper to find time series data for a metric by label
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HubSpotIcon className="size-5 text-[#FF7A59]" />
              <div>
                <CardTitle>HubSpot</CardTitle>
                <CardDescription className="mt-1">
                  Connect HubSpot to view CRM metrics and form submissions.
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
    <Collapsible defaultOpen className="group/section rounded-lg border p-4">
      <div className="flex items-center justify-between py-2">
        <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/section:-rotate-90'
            )}
          />
          <HubSpotIcon className="size-5 text-[#FF7A59]" />
          <span className="text-lg font-semibold">HubSpot</span>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="Total Contacts"
              value={metrics.crm.totalContacts}
              change={null}
              period={period}
              timeSeries={getTimeSeriesForMetric('Total Contacts')}
              color={HUBSPOT_COLOR}
            />
            <MetricCard
              label="Total Deals"
              value={metrics.crm.totalDeals}
              change={null}
              period={period}
              timeSeries={getTimeSeriesForMetric('Total Deals')}
              color={HUBSPOT_COLOR}
            />
            <MetricCard
              label="New Deals"
              value={metrics.crm.newDeals}
              change={metrics.crm.newDealsChange}
              period={period}
              timeSeries={getTimeSeriesForMetric('New Deals')}
              color={HUBSPOT_COLOR}
            />
            <MetricCard
              label="Pipeline Value"
              value={metrics.crm.totalPipelineValue}
              prefix="$"
              change={null}
              period={period}
              timeSeries={getTimeSeriesForMetric('Pipeline Value')}
              color={HUBSPOT_COLOR}
            />
            <MetricCard
              label="Deals Won"
              value={metrics.crm.dealsWon}
              change={metrics.crm.dealsWonChange}
              period={period}
              timeSeries={getTimeSeriesForMetric('Deals Won')}
              color={HUBSPOT_COLOR}
            />
            <MetricCard
              label="Deals Lost"
              value={metrics.crm.dealsLost}
              change={metrics.crm.dealsLostChange}
              period={period}
              timeSeries={getTimeSeriesForMetric('Deals Lost')}
              color={HUBSPOT_COLOR}
            />
            <MetricCard
              label="Form Submissions"
              value={metrics.marketing.formSubmissions}
              change={metrics.marketing.formSubmissionsChange}
              tooltip="Discovery inquiries from potential customers."
              period={period}
              timeSeries={getTimeSeriesForMetric('Form Submissions')}
              color={HUBSPOT_COLOR}
            />
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
