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

interface Metric {
  label: string
  value: number
  change: number | null
}

interface LinkedInSectionProps {
  isConnected: boolean
  period: Period
}

function formatMetricsForClipboard(metrics: Metric[], period: Period): string {
  const periodLabel = period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const lines = [`📊 LinkedIn Metrics (${periodLabel})`, '']
  for (const metric of metrics) {
    lines.push(`• ${metric.label}: ${metric.value.toLocaleString()}`)
  }
  return lines.join('\n')
}

export function LinkedInSection({ isConnected, period }: LinkedInSectionProps) {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getLinkedInMetrics(period)
        if (result.metrics) {
          setMetrics(result.metrics)
        }
      })
    }
  }, [isConnected, period])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = formatMetricsForClipboard(metrics, period)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isConnected) {
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
              <Link href="/settings/integrations">Connect</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Collapsible defaultOpen className="group/section">
      <div className="flex items-center justify-between rounded-md px-1 py-2">
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
        {metrics.length > 0 && (
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
      <CollapsibleContent className="mt-2 pl-8">
        {isPending ? (
          <div className="flex h-[100px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : metrics.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                change={metric.change}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
