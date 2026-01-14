import type { LinkedInCredentials, LinkedInMetrics } from './types'
import { getOAuthProvider } from '@/lib/oauth/registry'
import { Platform } from '@/lib/oauth/types'
import type { OAuthProvider } from '@/lib/oauth/base'

// Use REST API (not v2) for full analytics access
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest'
const LINKEDIN_VERSION = '202411' // November 2024 version

export class LinkedInClient {
  private accessToken: string
  private organizationId: string
  private credentials: LinkedInCredentials
  private connectionId: string | null
  private oauthProvider: OAuthProvider | null

  constructor(credentials: LinkedInCredentials, connectionId?: string) {
    this.credentials = credentials
    this.accessToken = credentials.access_token
    this.organizationId = credentials.organization_id
    this.connectionId = connectionId || null
    this.oauthProvider =
      connectionId && credentials.refresh_token ? getOAuthProvider(Platform.LINKEDIN) : null
  }

  private async ensureFreshToken(): Promise<void> {
    // Skip refresh if no OAuth provider or connection ID
    if (!this.oauthProvider || !this.connectionId) {
      return
    }

    // Check if token needs refresh
    if (this.oauthProvider.shouldRefreshToken(this.credentials.expires_at)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[LinkedIn Client] Refreshing token', {
          expiresAt: this.credentials.expires_at,
          connectionId: this.connectionId,
        })
      }

      try {
        const newTokens = await this.oauthProvider.refreshAccessToken(
          this.credentials.refresh_token
        )

        await this.oauthProvider.updateTokensInDatabase(this.connectionId, newTokens)

        // Update local credentials
        this.credentials = {
          ...this.credentials,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: this.oauthProvider.calculateExpiresAt(newTokens.expires_in),
        }
        this.accessToken = newTokens.access_token

        if (process.env.NODE_ENV === 'development') {
          console.log('[LinkedIn Client] Token refreshed successfully')
        }
      } catch (error) {
        console.error('[LinkedIn Client] Token refresh failed', {
          type: 'token_refresh_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })

        // Mark connection as failed so user knows to reconnect
        if (this.connectionId) {
          try {
            const { createClient } = await import('@/lib/supabase/server')
            const supabase = await createClient()
            await supabase
              .from('platform_connections')
              .update({ status: 'failed' })
              .eq('id', this.connectionId)

            if (process.env.NODE_ENV === 'development') {
              console.log('[LinkedIn Client] Connection marked as failed', {
                connectionId: this.connectionId,
              })
            }
          } catch (updateError) {
            console.error('[LinkedIn Client] Failed to update connection status', {
              type: 'database_update_error',
              error: updateError instanceof Error ? updateError.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            })
          }
        }

        throw error
      }
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    await this.ensureFreshToken()

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
          followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number }
          followerCountsByAssociationType?: Array<{
            followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number }
          }>
        }>
      }>(
        `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}`
      )

      // Calculate total followers from lifetime stats
      let totalFollowers = 0

      // Calculate total followers from followerCountsBySeniority (most reliable total)
      // followerCountsByAssociationType only shows EMPLOYEE followers, not total
      const firstElement = lifetimeData.elements?.[0] as Record<string, unknown> | undefined

      if (firstElement) {
        // Use followerCountsBySeniority to get true total (everyone has a seniority)
        const bySeniority = firstElement.followerCountsBySeniority as
          | Array<{
              followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number }
            }>
          | undefined

        if (Array.isArray(bySeniority)) {
          for (const item of bySeniority) {
            const organic = Number(item.followerCounts?.organicFollowerCount) || 0
            const paid = Number(item.followerCounts?.paidFollowerCount) || 0
            totalFollowers += organic + paid
          }
          console.log('[LinkedIn] Total followers from seniority breakdown:', totalFollowers)
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
          organicGain += Number(el.followerGains?.organicFollowerGain) || 0
          paidGain += Number(el.followerGains?.paidFollowerGain) || 0
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

      console.log('[LinkedIn] Page stats response:', JSON.stringify(data, null, 2))

      let pageViews = 0
      let uniqueVisitors = 0
      for (const el of data.elements || []) {
        // allPageViews is an object with pageViews and uniquePageViews inside
        const views = el.totalPageStatistics?.views?.allPageViews
        if (typeof views === 'object' && views !== null) {
          const viewsObj = views as { pageViews?: number; uniquePageViews?: number }
          pageViews += Number(viewsObj.pageViews) || 0
          uniqueVisitors += Number(viewsObj.uniquePageViews) || 0
        } else {
          pageViews += Number(views) || 0
        }
      }

      return { pageViews, uniqueVisitors }
    } catch (error) {
      console.error('[LinkedIn] Page stats error:', error)
      return { pageViews: 0, uniqueVisitors: 0 }
    }
  }

  // Get share/engagement statistics (requires r_organization_admin)
  async getShareStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    impressions: number
    clicks: number
    likes: number
    comments: number
    shares: number
    engagement: number
  }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${startDate.getTime()},end:${endDate.getTime()})`

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
        `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=(timeGranularityType:DAY,timeRange:${timeRange})`
      )

      console.log('[LinkedIn] Share stats response:', JSON.stringify(data, null, 2))

      // Sum up stats across all time intervals
      let impressions = 0
      let clicks = 0
      let likes = 0
      let comments = 0
      let shares = 0

      for (const el of data.elements || []) {
        const stats = el.totalShareStatistics || {}
        impressions += Number(stats.impressionCount) || 0
        clicks += Number(stats.clickCount) || 0
        likes += Number(stats.likeCount) || 0
        comments += Number(stats.commentCount) || 0
        shares += Number(stats.shareCount) || 0
      }

      return {
        impressions,
        clicks,
        likes,
        comments,
        shares,
        engagement: 0, // Engagement rate doesn't sum meaningfully
      }
    } catch (error) {
      console.error('[LinkedIn] Share stats error:', error)
      return { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, engagement: 0 }
    }
  }

  async getAllMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    const [followerStats, pageStats, shareStats] = await Promise.all([
      this.getFollowerStatistics(startDate, endDate),
      this.getPageStatistics(startDate, endDate),
      this.getShareStatistics(startDate, endDate),
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
