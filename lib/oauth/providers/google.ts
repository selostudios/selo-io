// lib/oauth/providers/google.ts
import { OAuthProvider } from '../base'
import { Platform, TokenResponse, Account } from '../types'

export class GoogleOAuthProvider extends OAuthProvider {
  platform = Platform.GOOGLE_ANALYTICS
  private clientId: string
  private clientSecret: string

  constructor() {
    super()
    this.validateConfig()
    this.clientId = process.env.GOOGLE_CLIENT_ID!
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  }

  private validateConfig(): void {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error(
        'Missing required Google OAuth environment variables. ' +
          'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local'
      )
    }
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      access_type: 'offline', // Required to get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

    if (process.env.NODE_ENV === 'development') {
      console.log('[Google OAuth] Authorization URL generated:', {
        state,
        redirectUri,
        scopes: 'analytics.readonly',
        fullUrl: url,
      })
    }

    return url
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!response.ok) {
      let error
      try {
        error = await response.json()
      } catch {
        error = await response.text()
      }
      console.error('[Google OAuth] Token exchange failed:', {
        status: response.status,
        error,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Token exchange failed: ${response.status}`)
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('[Google OAuth] Token exchange response:', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
        scopes: data.scope,
      })
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!response.ok) {
      let error
      try {
        error = await response.json()
      } catch {
        error = await response.text()
      }
      console.error('[Google OAuth] Token refresh failed:', {
        status: response.status,
        error,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('[Google OAuth] Token refreshed successfully:', {
        hasAccessToken: !!data.access_token,
        expiresIn: data.expires_in,
      })
    }

    // Google doesn't return a new refresh token on refresh
    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Keep the existing refresh token
      expires_in: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    }
  }

  async fetchUserAccounts(accessToken: string): Promise<Account[]> {
    // Fetch GA4 properties via Admin API
    const response = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error('[Google OAuth] Fetch accounts failed:', {
        status: response.status,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Failed to fetch Google Analytics properties: ${response.status}`)
    }

    const data = await response.json()

    // Flatten properties from all accounts
    const accounts: Account[] = []
    for (const accountSummary of data.accountSummaries || []) {
      for (const property of accountSummary.propertySummaries || []) {
        accounts.push({
          id: property.property, // e.g., "properties/123456789"
          name: `${property.displayName} (${accountSummary.displayName})`,
        })
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Google OAuth] Properties fetched:', {
        count: accounts.length,
        accounts: accounts.map((a: Account) => ({ id: a.id, name: a.name })),
      })
    }

    return accounts
  }
}
