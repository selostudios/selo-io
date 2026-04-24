import type { QuarterPeriods } from '@/lib/reviews/period'
import type { LinkedInData, LinkedInTopPost, MetricTriple } from '@/lib/reviews/types'
import { buildMetricTriple } from '@/lib/reviews/metric-triple'
import { isFeaturedLinkedInMetric } from '@/lib/reviews/linkedin-featured-metrics'
import { createServiceClient } from '@/lib/supabase/server'
import { PlatformType } from '@/lib/enums'

const THUMBNAIL_SIGNED_URL_TTL_SECONDS = 365 * 24 * 3600
const THUMBNAIL_BUCKET = 'linkedin-post-thumbnails'
const TOP_POSTS_LIMIT = 4

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

  const { data: postRows, error: postsError } = await supabase
    .from('linkedin_posts')
    .select(
      'linkedin_urn, post_url, thumbnail_path, caption, posted_at, impressions, reactions, comments, shares, engagement_rate'
    )
    .eq('organization_id', organizationId)
    .gte('posted_at', periods.main.start)
    .lte('posted_at', periods.main.end)
    .not('engagement_rate', 'is', null)
    .order('engagement_rate', { ascending: false })
    .limit(TOP_POSTS_LIMIT)

  if (postsError) {
    console.error('[Reviews] linkedin top posts query failed', {
      type: 'linkedin_top_posts_query_failed',
      organizationId,
      error: postsError.message,
      timestamp: new Date().toISOString(),
    })
    return { metrics, top_posts: [] }
  }

  const top_posts: LinkedInTopPost[] = await Promise.all(
    (postRows ?? []).map(async (row) => {
      let thumbnail_url: string | null = null
      if (row.thumbnail_path) {
        const { data: signed } = await supabase.storage
          .from(THUMBNAIL_BUCKET)
          .createSignedUrl(row.thumbnail_path, THUMBNAIL_SIGNED_URL_TTL_SECONDS)
        thumbnail_url = signed?.signedUrl ?? null
      }
      return {
        id: row.linkedin_urn,
        url: row.post_url,
        thumbnail_url,
        caption: row.caption,
        posted_at: row.posted_at,
        impressions: Number(row.impressions) || 0,
        reactions: Number(row.reactions) || 0,
        comments: Number(row.comments) || 0,
        shares: Number(row.shares) || 0,
        engagement_rate: Number(row.engagement_rate) || 0,
      }
    })
  )

  return { metrics, top_posts }
}
