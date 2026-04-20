import type { QuarterPeriods } from '@/lib/reviews/period'
import type { GAData } from '@/lib/reviews/types'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'
import { createServiceClient } from '@/lib/supabase/server'
import { PlatformType } from '@/lib/enums'

const GA_METRICS = [
  'ga_active_users',
  'ga_new_users',
  'ga_sessions',
  'ga_traffic_direct',
  'ga_traffic_organic_search',
  'ga_traffic_organic_social',
  'ga_traffic_referral',
  'ga_traffic_email',
] as const

export async function fetchGAData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<GAData> {
  const supabase = createServiceClient()

  const fetchSeries = async (start: string, end: string) => {
    const { data } = await supabase
      .from('campaign_metrics')
      .select('metric_type, date, value')
      .eq('organization_id', organizationId)
      .eq('platform_type', PlatformType.GoogleAnalytics)
      .in('metric_type', GA_METRICS as unknown as string[])
      .gte('date', start)
      .lte('date', end)
    return data ?? []
  }

  const [main, qoq, yoy] = await Promise.all([
    fetchSeries(periods.main.start, periods.main.end),
    fetchSeries(periods.qoq.start, periods.qoq.end),
    fetchSeries(periods.yoy.start, periods.yoy.end),
  ])

  const result: GAData = {}
  for (const metric of GA_METRICS) {
    const seriesFor = (rows: typeof main) =>
      rows.filter((r) => r.metric_type === metric).map((r) => Number(r.value))
    result[metric] = buildMetricTriple({
      current: seriesFor(main),
      qoq: seriesFor(qoq),
      yoy: seriesFor(yoy),
    })
  }
  return result
}
