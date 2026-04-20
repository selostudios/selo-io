export interface MarketingReview {
  id: string
  organization_id: string
  title: string
  quarter: string
  latest_snapshot_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface MarketingReviewSnapshot {
  id: string
  review_id: string
  version: number
  published_at: string
  published_by: string
  period_start: string
  period_end: string
  compare_qoq_start: string
  compare_qoq_end: string
  compare_yoy_start: string
  compare_yoy_end: string
  data: SnapshotData
  narrative: NarrativeBlocks
  share_token: string
}

export interface MarketingReviewDraft {
  id: string
  review_id: string
  updated_at: string
  data: SnapshotData
  narrative: NarrativeBlocks
  ai_originals: NarrativeBlocks
}

export interface SnapshotData {
  ga?: GAData
  linkedin?: LinkedInData
  hubspot?: HubSpotData
  email?: EmailData
  audit?: AuditInputData
}

export interface NarrativeBlocks {
  cover_subtitle?: string
  ga_summary?: string
  linkedin_insights?: string
  initiatives?: string
  takeaways?: string
  planning?: string
}

export type GAData = Record<string, MetricTriple>

export interface LinkedInData {
  metrics: Record<string, MetricTriple>
  top_posts?: LinkedInTopPost[]
}

export type HubSpotData = Record<string, MetricTriple>

export type EmailData = Record<string, MetricTriple>

export interface AuditInputData {
  audit_id: string
  seo_score: number | null
  performance_score: number | null
  ai_readiness_score: number | null
  top_failed_checks: Array<{
    id: string
    check_name: string
    display_name: string | null
    priority: string
    category: string
  }>
}

export interface MetricTriple {
  current: number
  qoq: number | null
  yoy: number | null
  qoq_delta_pct: number | null
  yoy_delta_pct: number | null
  timeseries?: {
    current: Array<{ date: string; value: number }>
    qoq: Array<{ date: string; value: number }>
    yoy: Array<{ date: string; value: number }>
  }
}

export interface LinkedInTopPost {
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
