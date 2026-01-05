// app/api/auth/oauth/[provider]/callback/route.ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Platform } from '@/lib/oauth/types'
import { getOAuthProvider, getRedirectUri } from '@/lib/oauth/registry'
import { getErrorMessage } from '@/lib/oauth/errors'

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
      const message = getErrorMessage('user_cancelled')
      return redirect(
        `/settings/integrations?error=${encodeURIComponent(message)}`
      )
    }

    // Validate required params
    if (!code || !state) {
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

    // Continue with token exchange in next step...
    // (Will be added in Task 8)

    return redirect('/settings/integrations')
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
