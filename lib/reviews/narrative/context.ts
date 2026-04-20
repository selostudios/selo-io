import type { LinkedInTopPost, MetricTriple, SnapshotData } from '@/lib/reviews/types'

type CompactMetricTriple = Omit<MetricTriple, 'timeseries'>

export interface CompactLinkedInTopPost {
  id: string
  url: string | null
  thumbnail_url: string | null
  caption: string | null
  posted_at: string
  impressions: number
  reactions: number
  comments: number
  shares: number
  engagement_rate: number
}

export interface CompactSnapshotPayload {
  ga?: Record<string, CompactMetricTriple>
  linkedin?: {
    metrics: Record<string, CompactMetricTriple>
    top_posts?: CompactLinkedInTopPost[]
  }
  hubspot?: Record<string, CompactMetricTriple>
  email?: Record<string, CompactMetricTriple>
  audit?: SnapshotData['audit']
}

const CAPTION_MAX = 160

function round2(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function compactTriple(triple: MetricTriple): CompactMetricTriple {
  return {
    current: round2(triple.current) ?? 0,
    qoq: round2(triple.qoq),
    yoy: round2(triple.yoy),
    qoq_delta_pct: round2(triple.qoq_delta_pct),
    yoy_delta_pct: round2(triple.yoy_delta_pct),
  }
}

function compactTripleMap(
  map: Record<string, MetricTriple> | undefined
): Record<string, CompactMetricTriple> | undefined {
  if (!map) return undefined
  const out: Record<string, CompactMetricTriple> = {}
  for (const [key, triple] of Object.entries(map)) {
    out[key] = compactTriple(triple)
  }
  return out
}

function compactTopPost(post: LinkedInTopPost): CompactLinkedInTopPost {
  const caption = post.caption
  const trimmed =
    caption && caption.length > CAPTION_MAX ? `${caption.slice(0, CAPTION_MAX - 1)}…` : caption
  return {
    id: post.id,
    url: post.url,
    thumbnail_url: post.thumbnail_url,
    caption: trimmed,
    posted_at: post.posted_at,
    impressions: post.impressions,
    reactions: post.reactions,
    comments: post.comments,
    shares: post.shares,
    engagement_rate: round2(post.engagement_rate) ?? 0,
  }
}

export function buildPromptContextPayload(data: SnapshotData): CompactSnapshotPayload {
  const payload: CompactSnapshotPayload = {}

  const ga = compactTripleMap(data.ga)
  if (ga) payload.ga = ga

  if (data.linkedin) {
    payload.linkedin = {
      metrics: compactTripleMap(data.linkedin.metrics) ?? {},
      ...(data.linkedin.top_posts && data.linkedin.top_posts.length > 0
        ? { top_posts: data.linkedin.top_posts.map(compactTopPost) }
        : {}),
    }
  }

  const hubspot = compactTripleMap(data.hubspot)
  if (hubspot) payload.hubspot = hubspot

  const email = compactTripleMap(data.email)
  if (email) payload.email = email

  if (data.audit) payload.audit = data.audit

  return payload
}
