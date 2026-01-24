'use client'

import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { TimeSeriesDataPoint } from '@/lib/metrics/types'

interface MetricTrendChartProps {
  data: TimeSeriesDataPoint[]
  label: string
  color?: string
}

export function MetricTrendChart({
  data,
  label,
  color = 'hsl(var(--primary))',
}: MetricTrendChartProps) {
  if (data.length < 2) {
    return (
      <p className="text-muted-foreground flex h-[120px] items-center justify-center text-sm">
        Not enough data for chart
      </p>
    )
  }

  const chartConfig = {
    value: {
      label: label,
      color: color,
    },
  } satisfies ChartConfig

  // Format date for display (e.g., "Jan 15")
  // Parse date as local time to avoid timezone shift
  const formattedData = data.map((point) => {
    const [year, month, day] = point.date.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return {
      ...point,
      formattedDate: localDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }
  })

  return (
    <ChartContainer config={chartConfig} className="h-[120px] w-full">
      <AreaChart
        data={formattedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={`fill-${label.replace(/\s/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="formattedDate"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          tickMargin={8}
          minTickGap={32}
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
          fill={`url(#fill-${label.replace(/\s/g, '-')})`}
        />
      </AreaChart>
    </ChartContainer>
  )
}
