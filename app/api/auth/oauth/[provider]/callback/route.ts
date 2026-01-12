// app/api/auth/oauth/[provider]/callback/route.ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Platform } from '@/lib/oauth/types'
import { getOAuthProvider, getRedirectUri } from '@/lib/oauth/registry'
import { getErrorMessage } from '@/lib/oauth/errors'

// Helper to clear OAuth cookies
function clearOAuthCookies(cookieStore: ReturnType<typeof cookies> extends Promise<infer T> ? T : never) {
  cookieStore.delete('oauth_state')
  cookieStore.delete('oauth_platform')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const cookieStore = await cookies()

  try {
    const { provider: providerParam } = await params
    const platform = providerParam as Platform

    // Validate platform
    if (!Object.values(Platform).includes(platform)) {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('unknown', {
        message: 'Invalid platform parameter',
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Get callback params
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denial
    if (error === 'user_cancelled_authorize' || error === 'access_denied') {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('user_cancelled')
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Validate required params
    if (!code || !state) {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('invalid_code', {
        message: 'Missing code or state parameter',
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Validate state (CSRF protection)
    const storedState = cookieStore.get('oauth_state')?.value
    const storedPlatform = cookieStore.get('oauth_platform')?.value

    if (!storedState || storedState !== state) {
      console.error('[OAuth Callback] Invalid state token', {
        type: 'csrf_attempt',
        timestamp: new Date().toISOString(),
      })
      const message = getErrorMessage('invalid_state')
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    if (storedPlatform !== platform) {
      console.error('[OAuth Callback] Platform mismatch', {
        type: 'platform_mismatch',
        expected: storedPlatform,
        received: platform,
        timestamp: new Date().toISOString(),
      })
      const message = getErrorMessage('invalid_state')
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Clear state cookies
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_platform')

    // Get OAuth provider
    const provider = getOAuthProvider(platform)
    const redirectUri = getRedirectUri(platform)

    // Exchange code for tokens
    let tokens
    try {
      tokens = await provider.exchangeCodeForTokens(code, redirectUri)
    } catch (err) {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('invalid_code', {
        statusCode: err instanceof Error ? 400 : undefined,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Fetch user's organizations/accounts
    let accounts
    try {
      accounts = await provider.fetchUserAccounts(tokens.access_token)
    } catch (err) {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('api_error', {
        endpoint: 'fetchUserAccounts',
        status: err instanceof Error ? 500 : undefined,
        response: err instanceof Error ? err.message : 'Unknown error',
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    if (accounts.length === 0) {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('no_organizations', {
        scopes: tokens.scopes,
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Auto-select first account (future: show selection UI for multiple)
    const selectedAccount = accounts[0]

    // Get current user and organization
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[OAuth Callback] Auth error', {
        type: 'auth_error',
        error: authError,
        timestamp: new Date().toISOString(),
      })
      return redirect('/login')
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userRecord) {
      console.error('[OAuth Callback] User fetch error', {
        type: 'database_error',
        error: userError,
        timestamp: new Date().toISOString(),
      })
      return redirect('/login')
    }

    // Check if already connected
    const { data: existing } = await supabase
      .from('platform_connections')
      .select('id')
      .eq('organization_id', userRecord.organization_id)
      .eq('platform_type', platform)
      .single()

    if (existing) {
      clearOAuthCookies(cookieStore)
      const message = getErrorMessage('already_connected', {
        orgId: selectedAccount.id,
        connectionId: existing.id,
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Save connection
    const expiresAt = provider.calculateExpiresAt(tokens.expires_in)

    const { error: insertError } = await supabase
      .from('platform_connections')
      .insert({
        organization_id: userRecord.organization_id,
        platform_type: platform,
        credentials: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          organization_id: selectedAccount.id,
          organization_name: selectedAccount.name,
          scopes: tokens.scopes || [],
        },
        status: 'active',
      })

    if (insertError) {
      clearOAuthCookies(cookieStore)
      console.error('[OAuth Callback] Failed to save connection', {
        type: 'database_error',
        error: insertError,
        timestamp: new Date().toISOString(),
      })
      const message = getErrorMessage('unknown', {
        message: 'Failed to save connection',
      })
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[OAuth Callback] Connection saved successfully', {
        platform,
        organizationId: selectedAccount.id,
        organizationName: selectedAccount.name,
      })
    }

    return redirect(`/settings/integrations?success=connected&platform=${platform}`)
  } catch (error) {
    console.error('[OAuth Callback Error]', {
      type: 'oauth_callback_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })

    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_platform')

    const message = getErrorMessage('unknown', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    return redirect(
      `/settings/integrations?error=${encodeURIComponent(message)}`
    )
  }
}
