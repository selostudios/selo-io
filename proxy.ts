import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELO_ORG_COOKIE = 'selo-org'

/** Routes that never carry an org prefix */
const NON_ORG_PREFIXES = [
  '/quick-audit',
  '/app-settings',
  '/organizations',
  '/support',
  '/login',
  '/onboarding',
  '/auth',
  '/accept-invite',
  '/api',
  '/s/',
  '/r/',
  '/_next',
  '/favicon',
]

/** Routes that require an org prefix */
const ORG_SCOPED_PREFIXES = ['/dashboard', '/seo', '/settings', '/ai-visibility']

async function refreshSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out.

  // IMPORTANT: Removing getClaims() can cause random logouts with SSR.
  // This call refreshes the session and ensures cookies are properly chunked
  // (preventing the 4096-byte cookie size limit from truncating session data).
  await supabase.auth.getClaims()

  return supabaseResponse
}

function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value)
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Skip static files (paths with extensions)
  if (pathname.includes('.')) {
    return NextResponse.next()
  }

  // 2. Skip non-org routes — just refresh session
  for (const prefix of NON_ORG_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return await refreshSupabaseSession(request)
    }
  }

  // 3. Already has org — first path segment is a UUID → sync cookie and pass through
  const firstSegment = pathname.split('/')[1] ?? ''
  if (UUID_RE.test(firstSegment)) {
    const response = await refreshSupabaseSession(request)
    response.cookies.set(SELO_ORG_COOKIE, firstSegment, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    })
    return response
  }

  // 4. Org-scoped route without org prefix — redirect
  const isOrgScoped = ORG_SCOPED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isOrgScoped) {
    const cookieOrgId = request.cookies.get(SELO_ORG_COOKIE)?.value

    if (cookieOrgId && UUID_RE.test(cookieOrgId)) {
      const url = request.nextUrl.clone()
      url.pathname = `/${cookieOrgId}${pathname}`
      const redirectResponse = NextResponse.redirect(url)
      // Preserve Supabase session cookies on redirect
      const sessionResponse = await refreshSupabaseSession(request)
      copySupabaseCookies(sessionResponse, redirectResponse)
      return redirectResponse
    }

    // No valid org cookie — send to org picker
    const url = request.nextUrl.clone()
    url.pathname = '/organizations'
    const redirectResponse = NextResponse.redirect(url)
    const sessionResponse = await refreshSupabaseSession(request)
    copySupabaseCookies(sessionResponse, redirectResponse)
    return redirectResponse
  }

  // 5. All other routes — pass through with session refresh
  return await refreshSupabaseSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api/cron (cron jobs don't have user sessions)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
