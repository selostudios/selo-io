import type { GoogleAnalyticsCredentials, GoogleAnalyticsMetrics } from './types'
import { getOAuthProvider } from '@/lib/oauth/registry'
import { Platform } from '@/lib/oauth/types'
import type { OAuthProvider } from '@/lib/oauth/base'

const GA_DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta'

export class GoogleAnalyticsClient {
  private accessToken: string
  private propertyId: string
  private credentials: GoogleAnalyticsCredentials
  private connectionId: string | null
  private oauthProvider: OAuthProvider | null

  constructor(credentials: GoogleAnalyticsCredentials, connectionId?: string) {
    this.credentials = credentials
    this.accessToken = credentials.access_token
    this.propertyId = credentials.property_id
    this.connectionId = connectionId || null
    this.oauthProvider =
      connectionId && credentials.refresh_token
        ? getOAuthProvider(Platform.GOOGLE_ANALYTICS)
        : null
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.oauthProvider || !this.connectionId) {
      return
    }

    if (this.oauthProvider.shouldRefreshToken(this.credentials.expires_at)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[GA Client] Refreshing token', {
          expiresAt: this.credentials.expires_at,
          connectionId: this.connectionId,
        })
      }

      try {
        const newTokens = await this.oauthProvider.refreshAccessToken(
          this.credentials.refresh_token
        )

        await this.oauthProvider.updateTokensInDatabase(this.connectionId, newTokens)

        this.credentials = {
          ...this.credentials,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: this.oauthProvider.calculateExpiresAt(newTokens.expires_in),
        }
        this.accessToken = newTokens.access_token

        if (process.env.NODE_ENV === 'development') {
          console.log('[GA Client] Token refreshed successfully')
        }
      } catch (error) {
        console.error('[GA Client] Token refresh failed', {
          type: 'token_refresh_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })

        if (this.connectionId) {
          try {
            const { createClient } = await import('@/lib/supabase/server')
            const supabase = await createClient()
            await supabase
              .from('platform_connections')
              .update({ status: 'failed' })
              .eq('id', this.connectionId)
          } catch (updateError) {
            console.error('[GA Client] Failed to update connection status')
          }
        }

        throw error
      }
    }
  }

  private async fetch<T>(endpoint: string, body?: object): Promise<T> {
    await this.ensureFreshToken()

    const response = await fetch(`${GA_DATA_API_BASE}${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
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
        return 'Google Analytics token expired or invalid. Please reconnect your account.'
      case 403:
        return 'Google Analytics access denied. Please check your permissions.'
      case 404:
        return 'Google Analytics property not found. Please check your property ID.'
      case 429:
        return 'Google Analytics rate limit exceeded. Please try again later.'
      default:
        try {
          const parsed = JSON.parse(body)
          return parsed.error?.message || `Google Analytics error: ${body}`
        } catch {
          return `Google Analytics error (${status}): ${body}`
        }
    }
  }

  async getMetrics(startDate: Date, endDate: Date): Promise<GoogleAnalyticsMetrics> {
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    try {
      const data = await this.fetch<{
        rows?: Array<{
          metricValues: Array<{ value: string }>
        }>
      }>(`/${this.propertyId}:runReport`, {
        dateRanges: [
          {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('[GA Client] Metrics response:', JSON.stringify(data, null, 2))
      }

      const row = data.rows?.[0]
      if (!row) {
        return { users: 0, sessions: 0, pageViews: 0 }
      }

      return {
        users: Number(row.metricValues[0]?.value) || 0,
        sessions: Number(row.metricValues[1]?.value) || 0,
        pageViews: Number(row.metricValues[2]?.value) || 0,
      }
    } catch (error) {
      console.error('[GA Client] Metrics error:', error)
      return { users: 0, sessions: 0, pageViews: 0 }
    }
  }
}
