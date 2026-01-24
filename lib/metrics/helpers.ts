import type {
  Period,
  DateRanges,
  MetricRecord,
  MetricTimeSeries,
  TimeSeriesDataPoint,
} from './types'

/**
 * Calculate date ranges for current and previous periods based on the selected period.
 */
export function getDateRanges(period: Period): DateRanges {
  const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90

  // Current period
  const currentEnd = new Date()
  const currentStart = new Date()
  currentStart.setDate(currentStart.getDate() - daysBack)

  // Previous period (same length, immediately before current)
  const previousEnd = new Date(currentStart)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - daysBack + 1)

  return { currentStart, currentEnd, previousStart, previousEnd }
}

/**
 * Format a date as YYYY-MM-DD string.
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Calculate percentage change between current and previous values.
 */
export function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}

/**
 * Sum metric values from DB records for a specific metric type within a date range.
 * Returns both the sum and whether any records were found.
 */
export function sumMetricInRange(
  metrics: MetricRecord[],
  metricType: string,
  startDate: Date,
  endDate: Date
): { sum: number; hasData: boolean } {
  const startStr = formatDateString(startDate)
  const endStr = formatDateString(endDate)

  const filtered = metrics.filter(
    (m) => m.metric_type === metricType && m.date >= startStr && m.date <= endStr
  )

  return {
    sum: filtered.reduce((sum, m) => sum + m.value, 0),
    hasData: filtered.length > 0,
  }
}

/**
 * Get the latest value for a metric type (for cumulative metrics like total_contacts).
 */
export function getLatestMetricValue(
  metrics: MetricRecord[],
  metricType: string,
  endDate: Date
): number {
  const endStr = formatDateString(endDate)

  const relevantMetrics = metrics
    .filter((m) => m.metric_type === metricType && m.date <= endStr)
    .sort((a, b) => b.date.localeCompare(a.date))

  return relevantMetrics[0]?.value ?? 0
}

/**
 * Calculate trend (percentage change) from DB metrics for a specific metric type.
 * Returns null for change if there's no data in the previous period (can't compute meaningful trend).
 */
export function calculateTrendFromDb(
  metrics: MetricRecord[],
  metricType: string,
  period: Period,
  isCumulative: boolean = false
): { current: number; change: number | null } {
  const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period)

  let current: number
  let previous: number
  let hasPreviousData: boolean

  if (isCumulative) {
    // For cumulative metrics, use latest value
    current = getLatestMetricValue(metrics, metricType, currentEnd)
    previous = getLatestMetricValue(metrics, metricType, previousEnd)
    // For cumulative, check if we have any data in the previous period range
    const previousCheck = sumMetricInRange(metrics, metricType, previousStart, previousEnd)
    hasPreviousData = previousCheck.hasData || previous > 0
  } else {
    // For period metrics, sum values in range
    const currentResult = sumMetricInRange(metrics, metricType, currentStart, currentEnd)
    const previousResult = sumMetricInRange(metrics, metricType, previousStart, previousEnd)
    current = currentResult.sum
    previous = previousResult.sum
    hasPreviousData = previousResult.hasData
  }

  // If we have no data in the previous period, we can't compute a meaningful trend
  if (!hasPreviousData) {
    return { current, change: null }
  }

  return {
    current,
    change: calculateChange(current, previous),
  }
}

/**
 * Build time series data from DB records for a specific metric type.
 */
export function buildTimeSeries(
  metrics: MetricRecord[],
  metricType: string,
  label: string,
  period: Period
): MetricTimeSeries {
  const { currentStart, currentEnd } = getDateRanges(period)
  const startStr = formatDateString(currentStart)
  const endStr = formatDateString(currentEnd)

  const data: TimeSeriesDataPoint[] = metrics
    .filter((m) => m.metric_type === metricType && m.date >= startStr && m.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.value }))

  return { metricType, label, data }
}

/**
 * Build multiple time series from DB records using a metric definition array.
 */
export function buildTimeSeriesArray(
  metrics: MetricRecord[],
  metricDefinitions: ReadonlyArray<{ metricType: string; label: string }>,
  period: Period
): MetricTimeSeries[] {
  return metricDefinitions.map((def) => buildTimeSeries(metrics, def.metricType, def.label, period))
}
