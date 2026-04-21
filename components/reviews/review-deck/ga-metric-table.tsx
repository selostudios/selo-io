import { GA_FEATURED_METRICS } from '@/lib/reviews/featured-metrics'
import { MetricFormat } from '@/lib/enums'
import type { GAData } from '@/lib/reviews/types'

interface GaMetricTableProps {
  data: GAData | undefined
}

const EM_DASH = '\u2014'

function formatValue(value: number | null, format: MetricFormat): string {
  if (value === null) return EM_DASH
  if (format === MetricFormat.Percent) return `${Math.round(value)}%`
  return value.toLocaleString()
}

function formatDelta(delta: number | null): string {
  if (delta === null) return EM_DASH
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

/**
 * Print-mode fallback for the GA body slide. Renders a compact 4-column table
 * (Metric | Current | QoQ | YoY) showing the same featured GA metrics as the
 * on-screen strip, without sparklines. Hidden on screen (`print:table`), shown
 * only when printing. Returns null when data is absent or no featured metrics
 * are present.
 */
export function GaMetricTable({ data }: GaMetricTableProps) {
  if (!data) return null

  const rows = GA_FEATURED_METRICS.map((meta) => ({ meta, triple: data[meta.key] })).filter(
    (
      row
    ): row is {
      meta: (typeof GA_FEATURED_METRICS)[number]
      triple: NonNullable<typeof row.triple>
    } => row.triple !== undefined
  )

  if (rows.length === 0) return null

  return (
    <table
      data-testid="ga-metric-table"
      className="hidden w-full border-collapse text-xs print:table print:w-full"
    >
      <thead>
        <tr className="border-b">
          <th className="py-1 pr-3 text-left font-medium">Metric</th>
          <th className="py-1 pr-3 text-right font-medium">Current</th>
          <th className="py-1 pr-3 text-right font-medium">QoQ</th>
          <th className="py-1 text-right font-medium">YoY</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ meta, triple }) => (
          <tr key={meta.key} className="border-b last:border-b-0">
            <td className="py-1 pr-3">{meta.label}</td>
            <td className="py-1 pr-3 text-right tabular-nums">
              {formatValue(triple.current, meta.format)}
            </td>
            <td className="py-1 pr-3 text-right tabular-nums">
              {formatDelta(triple.qoq_delta_pct)}
            </td>
            <td className="py-1 text-right tabular-nums">{formatDelta(triple.yoy_delta_pct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
