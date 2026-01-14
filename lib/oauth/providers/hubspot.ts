// lib/oauth/providers/hubspot.ts
import { OAuthProvider } from '../base'
import { Platform, TokenResponse, Account } from '../types'

export class HubSpotOAuthProvider extends OAuthProvider {
  platform = Platform.HUBSPOT
  private clientId: string
  private clientSecret: string

  constructor() {
    super()
    this.validateConfig()
    this.clientId = process.env.HUBSPOT_CLIENT_ID!
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET!
  }

  private validateConfig(): void {
    if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
      throw new Error(
        'Missing required HubSpot OAuth environment variables. ' +
          'Please set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in .env.local'
      )
    }
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.deals.read',
      'forms',
    ].join(' ')

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: state,
    })

    const url = `https://app.hubspot.com/oauth/authorize?${params}`

    if (process.env.NODE_ENV === 'development') {
      console.log('[HubSpot OAuth] Authorization URL generated:', {
        state,
        redirectUri,
        scopes,
        fullUrl: url,
      })
    }

    return url
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
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
      console.error('[HubSpot OAuth] Token exchange failed:', {
        status: response.status,
        error,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Token exchange failed: ${response.status}`)
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('[HubSpot OAuth] Token exchange response:', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
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
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
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
      console.error('[HubSpot OAuth] Token refresh failed:', {
        status: response.status,
        error,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('[HubSpot OAuth] Token refreshed successfully:', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
      })
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    }
  }

  async fetchUserAccounts(accessToken: string): Promise<Account[]> {
    // Get the HubSpot account info (portal ID and name)
    const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      let errorBody
      try {
        errorBody = await response.json()
      } catch {
        errorBody = await response.text()
      }
      console.error('[HubSpot OAuth] Fetch accounts failed:', {
        status: response.status,
        error: errorBody,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Failed to fetch HubSpot account info: ${response.status}`)
    }

    const data = await response.json()

    // HubSpot returns a single account (portal) per OAuth token
    const accounts: Account[] = [
      {
        id: data.hub_id.toString(),
        name: data.hub_domain || `HubSpot Account ${data.hub_id}`,
      },
    ]

    if (process.env.NODE_ENV === 'development') {
      console.log('[HubSpot OAuth] Account fetched:', {
        hubId: data.hub_id,
        hubDomain: data.hub_domain,
      })
    }

    return accounts
  }
}
