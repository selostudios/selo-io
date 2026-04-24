import type { QuarterPeriods } from '@/lib/reviews/period'
import type { LinkedInData, MetricTriple } from '@/lib/reviews/types'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'
import { isFeaturedLinkedInMetric } from '@/lib/reviews/linkedin-featured-metrics'
import { createServiceClient } from '@/lib/supabase/server'
import { PlatformType } from '@/lib/enums'

const LINKEDIN_METRICS = [
  'linkedin_followers',
  'linkedin_follower_growth',
  'linkedin_page_views',
  'linkedin_unique_visitors',
  'linkedin_impressions',
  'linkedin_reactions',
] as const

const CUMULATIVE_METRICS = new Set<string>(['linkedin_followers'])

export async function fetchLinkedInData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<LinkedInData | undefined> {
  const supabase = createServiceClient()

  const { data: connection } = await supabase
    .from('platform_connections')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('platform_type', PlatformType.LinkedIn)
    .eq('status', 'active')
    .maybeSingle()

  if (!connection) return undefined

  const fetchSeries = async (start: string, end: string) => {
    const { data } = await supabase
      .from('campaign_metrics')
      .select('metric_type, date, value')
      .eq('organization_id', organizationId)
      .eq('platform_type', PlatformType.LinkedIn)
      .in('metric_type', LINKEDIN_METRICS as unknown as string[])
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
    return data ?? []
  }

  const [main, qoq, yoy] = await Promise.all([
    fetchSeries(periods.main.start, periods.main.end),
    fetchSeries(periods.qoq.start, periods.qoq.end),
    fetchSeries(periods.yoy.start, periods.yoy.end),
  ])

  const metrics: Record<string, MetricTriple> = {}
  for (const metric of LINKEDIN_METRICS) {
    const seriesFor = (rows: typeof main) => {
      const filtered = rows.filter((r) => r.metric_type === metric).map((r) => Number(r.value))
      if (CUMULATIVE_METRICS.has(metric)) {
        return filtered.length > 0 ? [filtered[filtered.length - 1]] : []
      }
      return filtered
    }
    const triple = buildMetricTriple({
      current: seriesFor(main),
      qoq: seriesFor(qoq),
      yoy: seriesFor(yoy),
    })

    if (isFeaturedLinkedInMetric(metric)) {
      const toSeries = (rows: typeof main) =>
        rows
          .filter((r) => r.metric_type === metric)
          .map((r) => ({ date: r.date as string, value: Number(r.value) }))
      triple.timeseries = {
        current: toSeries(main),
        qoq: toSeries(qoq),
        yoy: toSeries(yoy),
      }
    }

    metrics[metric] = triple
  }
  return { metrics, top_posts: [] }
}
