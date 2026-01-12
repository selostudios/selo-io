// LinkedIn API response types

export interface LinkedInFollowerStatistics {
  organizationalEntityFollowerStatistics: {
    elements: Array<{
      timeRange: {
        start: number
        end: number
      }
      followerCounts: {
        organicFollowerCount: number
        paidFollowerCount: number
      }
      followerGains: {
        organicFollowerGain: number
        paidFollowerGain: number
      }
    }>
  }
}

export interface LinkedInPageStatistics {
  organizationPageStatistics: {
    elements: Array<{
      timeRange: {
        start: number
        end: number
      }
      views: {
        allPageViews: {
          pageViews: number
        }
        uniqueVisitors: number
      }
    }>
  }
}

export interface LinkedInShareStatistics {
  organizationalEntityShareStatistics: {
    elements: Array<{
      timeRange: {
        start: number
        end: number
      }
      totalShareStatistics: {
        impressionCount: number
        reactionCount: number
        shareCount: number
        commentCount: number
        clickCount: number
      }
    }>
  }
}

export interface LinkedInCredentials {
  access_token: string
  refresh_token: string
  expires_at: string // ISO 8601 timestamp
  organization_id: string
  organization_name: string
  scopes: string[]
}

export interface LinkedInMetrics {
  followers: number
  followerGrowth: number
  pageViews: number
  uniqueVisitors: number
  impressions: number
  reactions: number
}

export type LinkedInMetricType =
  | 'linkedin_followers'
  | 'linkedin_follower_growth'
  | 'linkedin_page_views'
  | 'linkedin_unique_visitors'
  | 'linkedin_impressions'
  | 'linkedin_reactions'

export const LINKEDIN_METRIC_TYPES: LinkedInMetricType[] = [
  'linkedin_followers',
  'linkedin_follower_growth',
  'linkedin_page_views',
  'linkedin_unique_visitors',
  'linkedin_impressions',
  'linkedin_reactions',
]
