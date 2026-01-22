'use client'

import { TrendingUp, TrendingDown, Info, Minus } from 'lucide-react'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Period } from './integrations-panel'
import type { TimeSeriesDataPoint } from '@/lib/metrics/types'

interface MetricCardProps {
  label: string
  value: number | string
  change: number | null
  prefix?: string
  tooltip?: string
  /** Period is used to calculate when trend data will be available */
  period?: Period
  /** Time series data for the inline chart */
  timeSeries?: TimeSeriesDataPoint[]
  /** Chart line/fill color */
  color?: string
}

function getTrendAvailabilityMessage(period?: Period): string {
  if (!period) {
    return 'Not enough historical data to show trends yet.'
  }

  const daysNeeded = period === '7d' ? 14 : period === '30d' ? 60 : 180
  const periodLabel = period === '7d' ? '7-day' : period === '30d' ? '30-day' : 'quarterly'

  return `Not enough historical data for ${periodLabel} trends. Trends will appear after ~${daysNeeded} days of data collection.`
}

export function MetricCard({
  label,
  value,
  change,
  prefix,
  tooltip,
  period,
  timeSeries,
  color = 'hsl(var(--primary))',
}: MetricCardProps) {
  const formattedValue =
    typeof value === 'number' ? `${prefix || ''}${value.toLocaleString()}` : value

  const isPositive = change !== null && change >= 0
  const hasChart = timeSeries && timeSeries.length >= 2

  const chartConfig = {
    value: {
      label: label,
      color: color,
    },
  } satisfies ChartConfig

  const formattedData = hasChart
    ? timeSeries.map((point) => ({
        ...point,
        formattedDate: new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }))
    : []

  // Create a unique gradient ID based on label
  const gradientId = `fill-${label.replace(/\s/g, '-')}`

  return (
    <Card className="@container/card">
      <CardHeader className="pb-2">
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
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formattedValue}
          </CardTitle>
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
        </div>
      </CardHeader>
      {hasChart && (
        <CardContent className="pt-0 pb-2">
          <ChartContainer config={chartConfig} className="h-[80px] w-full">
            <AreaChart data={formattedData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="formattedDate"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9 }}
                tickMargin={4}
                minTickGap={24}
              />
              <YAxis hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => value}
                    formatter={(value) => (
                      <span className="font-mono font-medium">{Number(value).toLocaleString()}</span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      )}
    </Card>
  )
}
