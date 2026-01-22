import { TrendingUp, TrendingDown, Info, Minus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { Period } from './integrations-panel'

interface MetricCardProps {
  label: string
  value: number | string
  change: number | null
  prefix?: string
  tooltip?: string
  /** Period is used to calculate when trend data will be available */
  period?: Period
}

function getTrendAvailabilityMessage(period?: Period): string {
  if (!period) {
    return 'Not enough historical data to show trends yet.'
  }

  const daysNeeded = period === '7d' ? 14 : period === '30d' ? 60 : 180
  const periodLabel = period === '7d' ? '7-day' : period === '30d' ? '30-day' : 'quarterly'

  return `Not enough historical data for ${periodLabel} trends. Trends will appear after ~${daysNeeded} days of data collection.`
}

export function MetricCard({ label, value, change, prefix, tooltip, period }: MetricCardProps) {
  const formattedValue =
    typeof value === 'number' ? `${prefix || ''}${value.toLocaleString()}` : value

  const isPositive = change !== null && change >= 0

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center gap-1">
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="text-muted-foreground size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {formattedValue}
        </CardTitle>
        <CardAction>
          {change !== null ? (
            <Badge variant="outline" className={isPositive ? 'text-green-600' : 'text-red-600'}>
              {isPositive ? (
                <TrendingUp className="mr-1 size-3" />
              ) : (
                <TrendingDown className="mr-1 size-3" />
              )}
              {isPositive ? '+' : ''}
              {change.toFixed(1)}%
            </Badge>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-muted-foreground cursor-help">
                  <Minus className="size-3" />
                  <span className="sr-only">No trend data</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                {getTrendAvailabilityMessage(period)}
              </TooltipContent>
            </Tooltip>
          )}
        </CardAction>
      </CardHeader>
    </Card>
  )
}
