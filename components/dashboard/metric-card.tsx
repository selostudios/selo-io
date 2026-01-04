interface MetricCardProps {
  label: string
  value: number
  change: number | null
}

export function MetricCard({ label, value, change }: MetricCardProps) {
  const formattedValue = value.toLocaleString()

  const isPositive = change !== null && change >= 0
  const isNegative = change !== null && change < 0

  return (
    <div className="flex flex-col">
      <span className="text-2xl font-bold">{formattedValue}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
      {change !== null && (
        <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  )
}
