import type { ReactElement } from 'react'
import { LINKEDIN_FEATURED_METRICS } from '@/lib/reviews/linkedin-featured-metrics'
import { formatMetricValue } from '@/lib/reviews/format'
import type { LinkedInData } from '@/lib/reviews/types'
import { DeckTrendBadge } from './deck-trend-badge'

interface LinkedInMetricStripProps {
  data: LinkedInData | undefined
}

/**
 * Screen-mode metric strip for the LinkedIn body slide. Mirrors
 * `GaMetricStrip`: responsive grid of label + large value + top-right sparkline
 * per featured LinkedIn metric that has a triple. Returns null when data is
 * absent or no featured metrics are present.
 */
export function LinkedInMetricStrip({ data }: LinkedInMetricStripProps) {
  if (!data) return null

  const items = LINKEDIN_FEATURED_METRICS.map((meta) => {
    const triple = data.metrics[meta.key]
    if (!triple) return null

    return (
      <div key={meta.key} data-testid={`linkedin-metric-strip-item-${meta.key}`}>
        <p className="text-muted-foreground text-sm md:text-base">{meta.label}</p>
        <p className="text-foreground mt-1 text-5xl font-semibold tabular-nums md:text-6xl">
          {formatMetricValue(triple.current, meta.format)}
        </p>
        <div className="mt-2">
          <DeckTrendBadge delta={triple.qoq_delta_pct} />
        </div>
      </div>
    )
  }).filter((node): node is ReactElement => node !== null)

  if (items.length === 0) return null

  return (
    <div data-testid="linkedin-metric-strip" className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {items}
    </div>
  )
}
