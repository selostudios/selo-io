'use client'

import type { ReactElement } from 'react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { GA_FEATURED_METRICS } from '@/lib/reviews/featured-metrics'
import { MetricFormat } from '@/lib/enums'
import type { GAData } from '@/lib/reviews/types'

interface GaMetricStripProps {
  data: GAData | undefined
}

// Widens the narrow `as const` enum member into the full `MetricFormat` union
// so that downstream comparisons remain valid if the config adds Percent
// entries later (see the engagement-rate TODO in featured-metrics.ts).
function formatCardValue(current: number, format: MetricFormat): number | string {
  if (format === MetricFormat.Percent) return `${Math.round(current)}%`
  return current
}

/**
 * Screen-mode metric strip for the GA body slide. Renders a responsive grid of
 * accent-variant `MetricCard`s — one per featured GA metric that has a triple.
 * Missing metrics are skipped (no placeholders). Returns null when data is
 * absent or no featured metrics are present.
 */
export function GaMetricStrip({ data }: GaMetricStripProps) {
  if (!data) return null

  const cards = GA_FEATURED_METRICS.map((meta) => {
    const triple = data[meta.key]
    if (!triple) return null

    const value = formatCardValue(triple.current, meta.format)

    return (
      <MetricCard
        key={meta.key}
        label={meta.label}
        value={value}
        change={triple.qoq_delta_pct}
        timeSeries={triple.timeseries?.current}
        variant="accent"
      />
    )
  }).filter((node): node is ReactElement => node !== null)

  if (cards.length === 0) return null

  return (
    <div data-testid="ga-metric-strip" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards}
    </div>
  )
}
