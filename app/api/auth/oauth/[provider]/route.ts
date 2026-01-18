// app/api/auth/oauth/[provider]/route.ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Platform } from '@/lib/oauth/types'
import { getOAuthProvider, getRedirectUri } from '@/lib/oauth/registry'

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: providerParam } = await params
    const platform = providerParam as Platform

    // Validate platform
    if (!Object.values(Platform).includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const provider = getOAuthProvider(platform)
    const state = provider.generateState()
    const redirectUri = getRedirectUri(platform)
    const authUrl = provider.getAuthorizationUrl(state, redirectUri)

    // Store state in httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    cookieStore.set('oauth_platform', platform, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    return redirect(authUrl)
  } catch (error) {
    // Re-throw redirect errors - they're not real errors
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }

    console.error('[OAuth Initiation Error]', {
      type: 'oauth_init_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })

    return redirect('/settings/integrations?error=unknown')
  }
}
