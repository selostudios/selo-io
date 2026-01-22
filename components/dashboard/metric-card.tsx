import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface MetricCardProps {
  label: string
  value: number | string
  change: number | null
  prefix?: string
  tooltip?: string
}

export function MetricCard({ label, value, change, prefix, tooltip }: MetricCardProps) {
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
        {change !== null && (
          <CardAction>
            <Badge variant="outline" className={isPositive ? 'text-green-600' : 'text-red-600'}>
              {isPositive ? (
                <TrendingUp className="mr-1 size-3" />
              ) : (
                <TrendingDown className="mr-1 size-3" />
              )}
              {isPositive ? '+' : ''}
              {change.toFixed(1)}%
            </Badge>
          </CardAction>
        )}
      </CardHeader>
    </Card>
  )
}
