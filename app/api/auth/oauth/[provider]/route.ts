// app/api/auth/oauth/[provider]/route.ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Platform } from '@/lib/oauth/types'
import { getOAuthProvider, getRedirectUri } from '@/lib/oauth/registry'
import { oauthLimiter, getIpFromRequest } from '@/lib/rate-limit'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractOrgIdFromReferer(request: Request): string {
  const referer = request.headers.get('referer') || ''
  if (!referer) return ''
  try {
    const firstSegment = new URL(referer).pathname.split('/').filter(Boolean)[0] || ''
    return UUID_REGEX.test(firstSegment) ? firstSegment : ''
  } catch {
    return ''
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  // Rate limit OAuth initiation
  const ip = getIpFromRequest(request)
  const limit = oauthLimiter.check(ip)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Require authentication — only logged-in users can connect platforms
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  // Extract orgId from referer so the callback can redirect back correctly
  const orgId = extractOrgIdFromReferer(request)
  const integrationsPath = orgId ? `/${orgId}/settings/integrations` : '/settings/integrations'

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

    // Store state in httpOnly cookies
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

    if (orgId) {
      cookieStore.set('oauth_org_id', orgId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      })
    }

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

    return redirect(`${integrationsPath}?error=unknown`)
  }
}
