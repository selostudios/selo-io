import { LINKEDIN_FEATURED_METRICS } from '@/lib/reviews/linkedin-featured-metrics'
import { formatMetricDelta, formatMetricValue } from '@/lib/reviews/format'
import type { LinkedInData } from '@/lib/reviews/types'

interface LinkedInMetricTableProps {
  data: LinkedInData | undefined
}

/**
 * Print-mode fallback for the LinkedIn body slide. Mirrors `GaMetricTable`:
 * compact 4-column table (Metric | Current | QoQ | YoY) showing featured
 * LinkedIn metrics. Hidden on screen, shown only when printing. Returns null
 * when data is absent or no featured metrics are present.
 */
export function LinkedInMetricTable({ data }: LinkedInMetricTableProps) {
  if (!data) return null

  const rows = LINKEDIN_FEATURED_METRICS.map((meta) => ({
    meta,
    triple: data.metrics[meta.key],
  })).filter(
    (
      row
    ): row is {
      meta: (typeof LINKEDIN_FEATURED_METRICS)[number]
      triple: NonNullable<typeof row.triple>
    } => row.triple !== undefined
  )

  if (rows.length === 0) return null

  return (
    <table
      data-testid="linkedin-metric-table"
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
              {formatMetricValue(triple.current, meta.format)}
            </td>
            <td className="py-1 pr-3 text-right tabular-nums">
              {formatMetricDelta(triple.qoq_delta_pct)}
            </td>
            <td className="py-1 text-right tabular-nums">
              {formatMetricDelta(triple.yoy_delta_pct)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
