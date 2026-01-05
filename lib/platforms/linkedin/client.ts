import type { LinkedInCredentials, LinkedInMetrics } from './types'
import { getOAuthProvider } from '@/lib/oauth/registry'
import { Platform } from '@/lib/oauth/types'
import type { OAuthProvider } from '@/lib/oauth/base'

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'

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
      connectionId && credentials.refresh_token
        ? getOAuthProvider(Platform.LINKEDIN)
        : null
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

        await this.oauthProvider.updateTokensInDatabase(
          this.connectionId,
          newTokens
        )

        // Update local credentials
        this.credentials = {
          ...this.credentials,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: this.oauthProvider.calculateExpiresAt(
            newTokens.expires_in
          ),
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
      },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    return response.json()
  }

  private formatDate(date: Date): number {
    return date.getTime()
  }

  async getFollowerStatistics(startDate: Date, endDate: Date): Promise<{ followers: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${this.formatDate(startDate)},end:${this.formatDate(endDate)})`

    const data = await this.fetch<{ elements: Array<{ followerGains: { organicFollowerGain: number; paidFollowerGain: number } }> }>(
      `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`
    )

    const totalGain = data.elements.reduce((sum, el) => {
      return sum + (el.followerGains?.organicFollowerGain || 0) + (el.followerGains?.paidFollowerGain || 0)
    }, 0)

    return { followers: totalGain }
  }

  async getPageStatistics(startDate: Date, endDate: Date): Promise<{ pageViews: number; uniqueVisitors: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${this.formatDate(startDate)},end:${this.formatDate(endDate)})`

    const data = await this.fetch<{ elements: Array<{ views: { allPageViews: { pageViews: number }; uniqueVisitors: number } }> }>(
      `/organizationPageStatistics?q=organization&organization=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`
    )

    const totals = data.elements.reduce(
      (acc, el) => ({
        pageViews: acc.pageViews + (el.views?.allPageViews?.pageViews || 0),
        uniqueVisitors: acc.uniqueVisitors + (el.views?.uniqueVisitors || 0),
      }),
      { pageViews: 0, uniqueVisitors: 0 }
    )

    return totals
  }

  async getShareStatistics(startDate: Date, endDate: Date): Promise<{ impressions: number; reactions: number }> {
    const orgUrn = `urn:li:organization:${this.organizationId}`
    const timeRange = `(start:${this.formatDate(startDate)},end:${this.formatDate(endDate)})`

    const data = await this.fetch<{ elements: Array<{ totalShareStatistics: { impressionCount: number; reactionCount: number } }> }>(
      `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange=${timeRange}`
    )

    const totals = data.elements.reduce(
      (acc, el) => ({
        impressions: acc.impressions + (el.totalShareStatistics?.impressionCount || 0),
        reactions: acc.reactions + (el.totalShareStatistics?.reactionCount || 0),
      }),
      { impressions: 0, reactions: 0 }
    )

    return totals
  }

  async getAllMetrics(startDate: Date, endDate: Date): Promise<LinkedInMetrics> {
    const [followers, pageStats, shareStats] = await Promise.all([
      this.getFollowerStatistics(startDate, endDate),
      this.getPageStatistics(startDate, endDate),
      this.getShareStatistics(startDate, endDate),
    ])

    return {
      followers: followers.followers,
      pageViews: pageStats.pageViews,
      uniqueVisitors: pageStats.uniqueVisitors,
      impressions: shareStats.impressions,
      reactions: shareStats.reactions,
    }
  }
}
