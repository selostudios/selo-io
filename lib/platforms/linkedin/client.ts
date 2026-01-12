import type { LinkedInCredentials, LinkedInMetrics } from './types'

// Use REST API (not v2) for full analytics access
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest'
const LINKEDIN_VERSION = '202411' // November 2024 version

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
        'Linkedin-Version': LINKEDIN_VERSION,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(this.formatError(response.status, errorBody))
    }

    return response.json()
  }

  private formatError(status: number, body: string): string {
    switch (status) {
      case 401:
        return 'LinkedIn token expired or invalid. Please reconnect your account.'
      case 403:
        return 'LinkedIn access denied. Your app may need additional permissions.'
      case 404:
        return 'LinkedIn organization not found. Please check your organization ID.'
      case 429:
        return 'LinkedIn rate limit exceeded. Please try again later.'
      default:
        try {
          const parsed = JSON.parse(body)
          return parsed.message || `LinkedIn error: ${body}`
        } catch {
          return `LinkedIn error (${status}): ${body}`
        }
    }
  }

  // Get follower statistics (lifetime and time-bound)
  async getFollowerStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ totalFollowers: number; organicGain: number; paidGain: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`

    try {
      // First get lifetime stats (total follower count)
      const lifetimeData = await this.fetch<{
        elements: Array<{
          followerCountsByAssociationType?: Array<{
            followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number }
          }>
        }>
      }>(
        `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}`
      )

      // Calculate total followers from lifetime stats
      let totalFollowers = 0
      const firstElement = lifetimeData.elements?.[0]
      if (firstElement?.followerCountsByAssociationType) {
        for (const assoc of firstElement.followerCountsByAssociationType) {
          totalFollowers +=
            (assoc.followerCounts?.organicFollowerCount || 0) +
            (assoc.followerCounts?.paidFollowerCount || 0)
        }
      }

      // If dates provided, get time-bound gains
      let organicGain = 0
      let paidGain = 0

      if (startDate && endDate) {
        const timeRange = `(start:${startDate.getTime()},end:${endDate.getTime()})`
        const timeData = await this.fetch<{
          elements: Array<{
            followerGains?: { organicFollowerGain: number; paidFollowerGain: number }
          }>
        }>(
          `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=(timeGranularityType:DAY,timeRange:${timeRange})`
        )

        for (const el of timeData.elements || []) {
          organicGain += el.followerGains?.organicFollowerGain || 0
          paidGain += el.followerGains?.paidFollowerGain || 0
        }
      }

      return { totalFollowers, organicGain, paidGain }
    } catch (error) {
      console.error('[LinkedIn] Follower stats error:', error)
      return { totalFollowers: 0, organicGain: 0, paidGain: 0 }
    }
  }

  // Get page statistics (requires r_organization_admin)
  async getPageStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{ pageViews: number; uniqueVisitors: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${startDate.getTime()},end:${endDate.getTime()})`

    try {
      const data = await this.fetch<{
        elements: Array<{
          totalPageStatistics?: {
            views?: { allPageViews?: number }
          }
        }>
      }>(
        `/organizationPageStatistics?q=organization&organization=${encodeURIComponent(orgUrn)}&timeIntervals=(timeGranularityType:DAY,timeRange:${timeRange})`
      )

      let pageViews = 0
      for (const el of data.elements || []) {
        pageViews += el.totalPageStatistics?.views?.allPageViews || 0
      }

      // Unique visitors not available in time-series, use lifetime query
      return { pageViews, uniqueVisitors: 0 }
    } catch {
      return { pageViews: 0, uniqueVisitors: 0 }
    }
  }

  // Get share/engagement statistics (requires r_organization_admin)
  async getShareStatistics(): Promise<{
    impressions: number
    clicks: number
    likes: number
    comments: number
    shares: number
    engagement: number
  }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`

    try {
      const data = await this.fetch<{
        elements: Array<{
          totalShareStatistics?: {
            impressionCount?: number
            clickCount?: number
            likeCount?: number
            commentCount?: number
            shareCount?: number
            engagement?: number
          }
        }>
      }>(
        `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}`
      )

      const stats = data.elements?.[0]?.totalShareStatistics || {}
      return {
        impressions: stats.impressionCount || 0,
        clicks: stats.clickCount || 0,
        likes: stats.likeCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0,
        engagement: stats.engagement || 0,
      }
    } catch {
      return { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, engagement: 0 }
    }
  }

  async getAllMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    const [followerStats, pageStats, shareStats] = await Promise.all([
      this.getFollowerStatistics(startDate, endDate),
      this.getPageStatistics(startDate, endDate),
      this.getShareStatistics(),
    ])

    return {
      followers: followerStats.totalFollowers,
      followerGrowth: followerStats.organicGain + followerStats.paidGain,
      pageViews: pageStats.pageViews,
      uniqueVisitors: pageStats.uniqueVisitors,
      impressions: shareStats.impressions,
      reactions: shareStats.likes + shareStats.comments + shareStats.shares,
    }
  }
}
