import type { SiteAudit } from '@/lib/audit/types'
import { formatDate } from '@/lib/utils'

interface ScoreTrendChartProps {
  audits: SiteAudit[]
}

export function ScoreTrendChart({ audits }: ScoreTrendChartProps) {
  // Filter to only completed audits with scores, then reverse to show oldest to newest
  const completedAudits = audits
    .filter((audit) => audit.status === 'completed' && audit.overall_score !== null)
    .reverse()

  if (completedAudits.length === 0) {
    return (
      <div className="text-muted-foreground flex h-24 items-center justify-center">
        No score data yet
      </div>
    )
  }

  // Single audit - show simple display instead of a chart
  if (completedAudits.length === 1) {
    const audit = completedAudits[0]
    const score = audit.overall_score as number
    return (
      <div className="flex items-center gap-6">
        <div className="flex items-baseline">
          <span className="text-4xl font-bold tabular-nums">{score}</span>
          <span className="text-muted-foreground text-lg">/100</span>
        </div>
        <div className="text-muted-foreground text-sm">
          <p>
            First audit completed {audit.completed_at ? formatDate(audit.completed_at, false) : ''}
          </p>
          <p className="text-xs">Run more audits to see score trends over time</p>
        </div>
      </div>
    )
  }

  const scores = completedAudits.map((audit) => audit.overall_score as number)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const latestScore = scores[scores.length - 1]
  const previousScore = scores[scores.length - 2]
  const change = latestScore - previousScore

  // Add padding to the range
  const range = maxScore - minScore
  const padding = range > 0 ? range * 0.2 : 10
  const chartMin = Math.max(0, minScore - padding)
  const chartMax = Math.min(100, maxScore + padding)
  const chartRange = chartMax - chartMin || 1

  // SVG dimensions
  const width = 400
  const height = 80
  const paddingX = 12
  const paddingY = 12
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2

  // Generate points for the polyline
  const points = scores
    .map((score, index) => {
      const x = paddingX + (index / (scores.length - 1)) * chartWidth
      const y = paddingY + chartHeight - ((score - chartMin) / chartRange) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  // Generate area fill points
  const areaPoints = [
    `${paddingX},${paddingY + chartHeight}`,
    ...scores.map((score, index) => {
      const x = paddingX + (index / (scores.length - 1)) * chartWidth
      const y = paddingY + chartHeight - ((score - chartMin) / chartRange) * chartHeight
      return `${x},${y}`
    }),
    `${paddingX + chartWidth},${paddingY + chartHeight}`,
  ].join(' ')

  // Generate circles for data points
  const circles = scores.map((score, index) => {
    const x = paddingX + (index / (scores.length - 1)) * chartWidth
    const y = paddingY + chartHeight - ((score - chartMin) / chartRange) * chartHeight
    return { x, y, score }
  })

  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-20 w-full max-w-[400px]"
        aria-label={`Score trend from ${scores[0]} to ${latestScore}`}
        role="img"
      >
        {/* Area fill */}
        <polygon points={areaPoints} className="fill-primary/10" />
        {/* Trend line */}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
        />
        {/* Data points */}
        {circles.map((circle, index) => (
          <circle key={index} cx={circle.x} cy={circle.y} r="4" className="fill-primary" />
        ))}
      </svg>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{latestScore}</span>
          <span className="text-muted-foreground">/100</span>
          {change !== 0 && (
            <span
              className={`text-sm font-medium tabular-nums ${change > 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {change > 0 ? '+' : ''}
              {change}
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {completedAudits.length} audits · Range: {minScore}–{maxScore}
        </span>
      </div>
    </div>
  )
}
