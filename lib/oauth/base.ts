// lib/oauth/base.ts
import { randomBytes } from 'crypto'
import { Platform, TokenResponse, Account } from './types'
import { createClient } from '@/lib/supabase/server'

export abstract class OAuthProvider {
  abstract platform: Platform

  /**
   * Build authorization URL for OAuth flow initiation
   */
  abstract getAuthorizationUrl(state: string, redirectUri: string): string

  /**
   * Exchange authorization code for access + refresh tokens
   */
  abstract exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<TokenResponse>

  /**
   * Refresh access token using refresh token
   */
  abstract refreshAccessToken(refreshToken: string): Promise<TokenResponse>

  /**
   * Fetch user's accounts/organizations for this platform
   */
  abstract fetchUserAccounts(accessToken: string): Promise<Account[]>

  /**
   * Generate cryptographically secure state token for CSRF protection
   */
  generateState(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Check if token should be refreshed (< 7 days until expiration)
   */
  shouldRefreshToken(expiresAt: string): boolean {
    const expiresDate = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiration =
      (expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    return daysUntilExpiration < 7
  }

  /**
   * Calculate expires_at timestamp from expires_in seconds
   */
  calculateExpiresAt(expiresIn: number): string {
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn)
    return expiresAt.toISOString()
  }

  /**
   * Update tokens in database after refresh
   */
  async updateTokensInDatabase(
    connectionId: string,
    tokens: TokenResponse
  ): Promise<void> {
    const supabase = await createClient()
    const expiresAt = this.calculateExpiresAt(tokens.expires_in)

    const { error } = await supabase.rpc('update_oauth_tokens', {
      p_connection_id: connectionId,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_expires_at: expiresAt,
    })

    if (error) {
      console.error('[OAuth Token Update Error]', {
        type: 'database_error',
        connectionId,
        timestamp: new Date().toISOString(),
      })
      throw new Error('Failed to update tokens in database')
    }
  }
}
