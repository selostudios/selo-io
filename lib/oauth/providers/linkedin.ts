// lib/oauth/providers/linkedin.ts
import { OAuthProvider } from '../base'
import { Platform, TokenResponse, Account } from '../types'

export class LinkedInOAuthProvider extends OAuthProvider {
  platform = Platform.LINKEDIN

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      state: state,
      scope: 'r_organization_social r_organization_admin rw_organization_admin',
    })

    const url = `https://www.linkedin.com/oauth/v2/authorization?${params}`

    if (process.env.NODE_ENV === 'development') {
      console.log('[LinkedIn OAuth] Authorization URL generated:', {
        state,
        redirectUri,
        scopes: 'r_organization_social r_organization_admin rw_organization_admin',
        fullUrl: url,
      })
    }

    return url
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    const response = await fetch(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('[LinkedIn OAuth] Token exchange failed:', {
        status: response.status,
        error,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Token exchange failed: ${response.status}`)
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('[LinkedIn OAuth] Token exchange response:', {
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
    const response = await fetch(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('[LinkedIn OAuth] Token refresh failed:', {
        status: response.status,
        error,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('[LinkedIn OAuth] Token refreshed successfully:', {
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
    const response = await fetch(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName,id)))',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    )

    if (!response.ok) {
      console.error('[LinkedIn OAuth] Fetch accounts failed:', {
        status: response.status,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Failed to fetch LinkedIn organizations: ${response.status}`)
    }

    const data = await response.json()

    const accounts = data.elements.map((el: any) => ({
      id: el['organization~'].id.toString(),
      name: el['organization~'].localizedName,
    }))

    if (process.env.NODE_ENV === 'development') {
      console.log('[LinkedIn OAuth] Accounts fetched:', {
        count: accounts.length,
        accounts: accounts.map((a: Account) => ({ id: a.id, name: a.name })),
      })
    }

    return accounts
  }
}
