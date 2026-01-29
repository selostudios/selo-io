import { Period } from '@/lib/enums'
import type { MetricTimeSeries } from '@/lib/metrics/types'
import type { ReactNode } from 'react'

export interface PlatformConnection {
  id: string
  account_name: string | null
  display_name: string | null
}

export interface BaseMetric {
  label: string
  value: number
  change: number | null
}

export interface PlatformConfig {
  name: string
  color: string
  icon: ReactNode
  connectHref: string
  connectDescription: string
}

export interface PlatformSectionProps<TMetrics> {
  connections: PlatformConnection[]
  period: Period
  config: PlatformConfig
  getMetrics: (
    connectionId: string,
    period: Period
  ) => Promise<{
    metrics?: TMetrics
    timeSeries?: MetricTimeSeries[]
  }>
  formatMetricsForClipboard: (metrics: TMetrics, period: Period, accountName?: string) => string
  renderMetrics: (metrics: TMetrics, timeSeries: MetricTimeSeries[], period: Period) => ReactNode
}

export function getConnectionLabel(connection: PlatformConnection): string {
  return connection.display_name || connection.account_name || 'Unknown Account'
}

// Re-export shared utilities
export { formatChange, getPeriodLabel, formatNumber } from '@/lib/metrics/format'
