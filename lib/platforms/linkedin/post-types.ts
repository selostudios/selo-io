export enum LinkedInPostType {
  Image = 'image',
  Video = 'video',
  Text = 'text',
  Article = 'article',
  Poll = 'poll',
}

const VALID = new Set<string>(Object.values(LinkedInPostType))

export function isLinkedInPostType(value: string): value is LinkedInPostType {
  return VALID.has(value)
}

export interface LinkedInPostRow {
  id: string
  organization_id: string
  platform_connection_id: string
  linkedin_urn: string
  posted_at: string
  caption: string | null
  post_url: string | null
  thumbnail_path: string | null
  post_type: LinkedInPostType
  impressions: number
  reactions: number
  comments: number
  shares: number
  engagement_rate: number | null
  analytics_updated_at: string | null
  created_at: string
}
