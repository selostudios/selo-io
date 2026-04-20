import type { QuarterPeriods } from '@/lib/reviews/period'
import type { HubSpotData, EmailData } from '@/lib/reviews/types'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'
import { createServiceClient } from '@/lib/supabase/server'
import { PlatformType } from '@/lib/enums'

const HUBSPOT_METRICS = [
  'hubspot_total_contacts',
  'hubspot_total_deals',
  'hubspot_new_deals',
  'hubspot_total_pipeline_value',
  'hubspot_deals_won',
  'hubspot_deals_lost',
  'hubspot_form_submissions',
] as const

const CUMULATIVE_METRICS = new Set<string>([
  'hubspot_total_contacts',
  'hubspot_total_deals',
  'hubspot_total_pipeline_value',
])

export async function fetchHubSpotData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<HubSpotData> {
  const supabase = createServiceClient()

  const fetchSeries = async (start: string, end: string) => {
    const { data } = await supabase
      .from('campaign_metrics')
      .select('metric_type, date, value')
      .eq('organization_id', organizationId)
      .eq('platform_type', PlatformType.HubSpot)
      .in('metric_type', HUBSPOT_METRICS as unknown as string[])
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

  const result: HubSpotData = {}
  for (const metric of HUBSPOT_METRICS) {
    const seriesFor = (rows: typeof main) => {
      const filtered = rows.filter((r) => r.metric_type === metric).map((r) => Number(r.value))
      if (CUMULATIVE_METRICS.has(metric)) {
        return filtered.length > 0 ? [filtered[filtered.length - 1]] : []
      }
      return filtered
    }
    result[metric] = buildMetricTriple({
      current: seriesFor(main),
      qoq: seriesFor(qoq),
      yoy: seriesFor(yoy),
    })
  }
  return result
}

// HubSpot does not currently expose email engagement metrics. Return empty
// until a dedicated email adapter lands; the editor renders "no data" for
// this slide.
export async function fetchEmailData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<EmailData> {
  void organizationId
  void periods
  return {}
}
