import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface MetricCardProps {
  label: string
  value: number | string
  change: number | null
  prefix?: string
}

export function MetricCard({ label, value, change, prefix }: MetricCardProps) {
  const formattedValue =
    typeof value === 'number' ? `${prefix || ''}${value.toLocaleString()}` : value

  const isPositive = change !== null && change >= 0

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
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
