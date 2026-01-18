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
  abstract exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse>

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
    const daysUntilExpiration = (expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

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
  async updateTokensInDatabase(connectionId: string, tokens: TokenResponse): Promise<void> {
    const supabase = await createClient()
    const expiresAt = this.calculateExpiresAt(tokens.expires_in)

    // Get current credentials to preserve other fields
    const { data: connection, error: fetchError } = await supabase
      .from('platform_connections')
      .select('credentials')
      .eq('id', connectionId)
      .single()

    if (fetchError || !connection) {
      console.error('[OAuth Token Update Error]', {
        type: 'fetch_error',
        connectionId,
        error: fetchError?.message,
        timestamp: new Date().toISOString(),
      })
      throw new Error('Failed to fetch connection for token update')
    }

    // Merge new tokens with existing credentials
    const updatedCredentials = {
      ...(connection.credentials as Record<string, unknown>),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    }

    const { error } = await supabase
      .from('platform_connections')
      .update({
        credentials: updatedCredentials,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    if (error) {
      console.error('[OAuth Token Update Error]', {
        type: 'update_error',
        connectionId,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      })
      throw new Error('Failed to update tokens in database')
    }
  }
}
