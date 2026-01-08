import type { LinkedInCredentials, LinkedInMetrics } from './types'

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'

export class LinkedInClient {
  private accessToken: string
  private organizationId: string

  constructor(credentials: LinkedInCredentials) {
    this.accessToken = credentials.access_token
    this.organizationId = credentials.organization_id
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${LINKEDIN_API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`LinkedIn API error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }

  // Get total follower count (works without MDP access)
  async getFollowerCount(): Promise<number> {
    const orgUrn = `urn:li:organization:${this.organizationId}`

    const data = await this.fetch<{
      firstDegreeSize: number
    }>(`/networkSizes/${encodeURIComponent(orgUrn)}?edgeType=CompanyFollowedByMember`)

    return data.firstDegreeSize || 0
  }

  // Get recent posts and their engagement (works without MDP access)
  async getPostEngagement(): Promise<{ impressions: number; reactions: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`

    try {
      const data = await this.fetch<{
        elements: Array<{
          id: string
          socialMetadata?: {
            totalSocialActivityCounts?: {
              numLikes?: number
              numComments?: number
              numShares?: number
            }
          }
        }>
      }>(`/posts?author=${encodeURIComponent(orgUrn)}&q=author&count=50`)

      // Sum up engagement from recent posts
      let totalReactions = 0
      for (const post of data.elements || []) {
        const counts = post.socialMetadata?.totalSocialActivityCounts
        if (counts) {
          totalReactions +=
            (counts.numLikes || 0) + (counts.numComments || 0) + (counts.numShares || 0)
        }
      }

      return {
        impressions: 0, // Not available without MDP
        reactions: totalReactions,
      }
    } catch {
      // Posts endpoint may not be available, return zeros
      return { impressions: 0, reactions: 0 }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAllMetrics(_startDate: Date, _endDate: Date): Promise<LinkedInMetrics> {
    const [followers, engagement] = await Promise.all([
      this.getFollowerCount(),
      this.getPostEngagement(),
    ])

    return {
      followers,
      pageViews: 0, // Not available without MDP
      uniqueVisitors: 0, // Not available without MDP
      impressions: engagement.impressions,
      reactions: engagement.reactions,
    }
  }
}
