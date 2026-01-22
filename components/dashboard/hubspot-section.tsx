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
import type { HubSpotMetrics } from '@/lib/platforms/hubspot/types'
import type { Period } from './integrations-panel'

interface HubSpotSectionProps {
  isConnected: boolean
  period: Period
}

function formatMetricsForClipboard(metrics: HubSpotMetrics, period: Period): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const lines = [
    `🟠 HubSpot Metrics (${periodLabel})`,
    '',
    '**CRM**',
    `• Total Contacts: ${metrics.crm.totalContacts.toLocaleString()}`,
    `• Total Deals: ${metrics.crm.totalDeals.toLocaleString()}`,
    `• New Deals: ${metrics.crm.newDeals.toLocaleString()}`,
    `• Pipeline Value: $${metrics.crm.totalPipelineValue.toLocaleString()}`,
    `• Deals Won: ${metrics.crm.dealsWon.toLocaleString()}`,
    `• Deals Lost: ${metrics.crm.dealsLost.toLocaleString()}`,
    '',
    '**Forms**',
    `• Form Submissions: ${metrics.marketing.formSubmissions.toLocaleString()}`,
  ]
  return lines.join('\n')
}

export function HubSpotSection({ isConnected, period }: HubSpotSectionProps) {
  const [metrics, setMetrics] = useState<HubSpotMetrics | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getHubSpotMetrics(period)
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
    <Collapsible defaultOpen className="group/section rounded-lg border py-4">
      <div className="bg-background flex items-center justify-between rounded-md px-4 py-3">
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
          <div className="space-y-6">
            {/* CRM Metrics */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">CRM</h4>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <MetricCard
                  label="Total Contacts"
                  value={metrics.crm.totalContacts}
                  change={null}
                />
                <MetricCard label="Total Deals" value={metrics.crm.totalDeals} change={null} />
                <MetricCard label="New Deals" value={metrics.crm.newDeals} change={null} />
                <MetricCard
                  label="Pipeline Value"
                  value={metrics.crm.totalPipelineValue}
                  prefix="$"
                  change={null}
                />
                <MetricCard label="Deals Won" value={metrics.crm.dealsWon} change={null} />
                <MetricCard label="Deals Lost" value={metrics.crm.dealsLost} change={null} />
              </div>
            </div>

            {/* Forms */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Forms</h4>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <MetricCard
                  label="Form Submissions"
                  value={metrics.marketing.formSubmissions}
                  change={null}
                  tooltip="Discovery inquiries from potential customers."
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
