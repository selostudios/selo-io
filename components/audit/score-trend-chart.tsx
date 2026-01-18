import type { SiteAudit } from '@/lib/audit/types'

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

  const scores = completedAudits.map((audit) => audit.overall_score as number)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)

  // Add padding to the range
  const range = maxScore - minScore
  const padding = range > 0 ? range * 0.1 : 10
  const chartMin = Math.max(0, minScore - padding)
  const chartMax = Math.min(100, maxScore + padding)
  const chartRange = chartMax - chartMin

  // SVG dimensions
  const width = 300
  const height = 80
  const paddingX = 8
  const paddingY = 8
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2

  // Generate points for the polyline
  const points = scores
    .map((score, index) => {
      const x = paddingX + (index / Math.max(scores.length - 1, 1)) * chartWidth
      const y = paddingY + chartHeight - ((score - chartMin) / chartRange) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  // Generate circles for data points
  const circles = scores.map((score, index) => {
    const x = paddingX + (index / Math.max(scores.length - 1, 1)) * chartWidth
    const y = paddingY + chartHeight - ((score - chartMin) / chartRange) * chartHeight
    return { x, y, score }
  })

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-20 w-full max-w-[300px]"
        aria-label={`Score trend from ${scores[0]} to ${scores[scores.length - 1]}`}
        role="img"
      >
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
      <div className="flex flex-col text-sm">
        <span className="text-muted-foreground">
          {scores[0]} → {scores[scores.length - 1]}
        </span>
        <span className="text-muted-foreground text-xs">
          Min: {minScore} / Max: {maxScore}
        </span>
      </div>
    </div>
  )
}
