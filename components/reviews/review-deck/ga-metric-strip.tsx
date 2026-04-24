import type { ReactElement } from 'react'
import { GA_FEATURED_METRICS } from '@/lib/reviews/featured-metrics'
import { formatMetricValue } from '@/lib/reviews/format'
import type { GAData } from '@/lib/reviews/types'
import { DeckSparkline } from './deck-sparkline'

interface GaMetricStripProps {
  data: GAData | undefined
}

/**
 * Screen-mode metric strip for the GA body slide. Renders a responsive grid of
 * label + large value + top-right sparkline per featured GA metric that has a
 * triple. Missing metrics are skipped (no placeholders). Returns null when data
 * is absent or no featured metrics are present.
 */
export function GaMetricStrip({ data }: GaMetricStripProps) {
  if (!data) return null

  const items = GA_FEATURED_METRICS.map((meta) => {
    const triple = data[meta.key]
    if (!triple) return null

    const series = triple.timeseries?.current ?? []

    return (
      <div key={meta.key} data-testid={`ga-metric-strip-item-${meta.key}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-sm md:text-base">{meta.label}</p>
          <DeckSparkline data={series} gradientId={`ga-spark-${meta.key}`} />
        </div>
        <p className="text-foreground mt-1 text-5xl font-semibold tabular-nums md:text-6xl">
          {formatMetricValue(triple.current, meta.format)}
        </p>
      </div>
    )
  }).filter((node): node is ReactElement => node !== null)

  if (items.length === 0) return null

  return (
    <div data-testid="ga-metric-strip" className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {items}
    </div>
  )
}
