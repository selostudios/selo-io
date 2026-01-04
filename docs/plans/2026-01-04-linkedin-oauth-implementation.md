# LinkedIn OAuth 2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace manual LinkedIn token entry with OAuth 2.0 flow including automatic token refresh, building generic OAuth infrastructure for all future platforms.

**Architecture:** Generic OAuth base class with platform-specific providers. Dynamic API routes handle all OAuth platforms. Proactive token refresh before 7-day expiration threshold. CSRF protection via state tokens in httpOnly cookies.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node.js crypto module, LinkedIn OAuth 2.0 API

---

## Phase 1: Foundation - OAuth Types and Base Class

### Task 1: Create OAuth Types and Platform Enum

**Files:**
- Create: `lib/oauth/types.ts`

**Step 1: Create OAuth types file with Platform enum**

```typescript
// lib/oauth/types.ts

export enum Platform {
  LINKEDIN = 'linkedin',
  GOOGLE_ANALYTICS = 'google_analytics',
  INSTAGRAM = 'instagram',
  HUBSPOT = 'hubspot',
  META = 'meta'
}

export type PlatformType = `${Platform}`

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds
  scopes?: string[]
}

export interface Account {
  id: string
  name: string
}

export interface OAuthCredentials {
  access_token: string
  refresh_token: string
  expires_at: string // ISO 8601
  organization_id: string
  organization_name: string
  scopes: string[]
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/oauth/types.ts
git commit -m "feat(oauth): add platform enum and OAuth types

- Platform enum for type-safe platform references
- TokenResponse, Account, OAuthCredentials interfaces
- Foundation for generic OAuth infrastructure

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create OAuth Base Class

**Files:**
- Create: `lib/oauth/base.ts`

**Step 1: Create abstract OAuth provider base class**

```typescript
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

    const { error } = await supabase
      .from('platform_connections')
      .update({
        credentials: supabase.raw(`
          jsonb_set(
            jsonb_set(
              jsonb_set(
                credentials,
                '{access_token}',
                to_jsonb(${JSON.stringify(tokens.access_token)}::text)
              ),
              '{refresh_token}',
              to_jsonb(${JSON.stringify(tokens.refresh_token)}::text)
            ),
            '{expires_at}',
            to_jsonb(${JSON.stringify(expiresAt)}::text)
          )
        `),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

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
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/oauth/base.ts
git commit -m "feat(oauth): add abstract OAuth provider base class

- Abstract methods for platform-specific OAuth operations
- Shared utilities: state generation, token refresh check
- Database token update with JSONB manipulation
- 7-day proactive refresh threshold

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: LinkedIn OAuth Provider

### Task 3: Create LinkedIn OAuth Provider

**Files:**
- Create: `lib/oauth/providers/linkedin.ts`

**Step 1: Create LinkedIn OAuth provider**

```typescript
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
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/oauth/providers/linkedin.ts
git commit -m "feat(oauth): add LinkedIn OAuth provider implementation

- Authorization URL with required scopes
- Token exchange and refresh endpoints
- Organization accounts fetching
- Development logging for debugging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Create OAuth Provider Registry

**Files:**
- Create: `lib/oauth/registry.ts`

**Step 1: Create provider registry and factory**

```typescript
// lib/oauth/registry.ts
import { Platform } from './types'
import { OAuthProvider } from './base'
import { LinkedInOAuthProvider } from './providers/linkedin'

const providers = {
  [Platform.LINKEDIN]: LinkedInOAuthProvider,
  // Future providers:
  // [Platform.GOOGLE_ANALYTICS]: GoogleOAuthProvider,
  // [Platform.INSTAGRAM]: MetaOAuthProvider,
  // [Platform.HUBSPOT]: HubSpotOAuthProvider,
} as const

export function getOAuthProvider(platform: Platform): OAuthProvider {
  const ProviderClass = providers[platform]

  if (!ProviderClass) {
    throw new Error(`OAuth provider not found for platform: ${platform}`)
  }

  return new ProviderClass()
}

export function getRedirectUri(platform: Platform): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/oauth/${platform}/callback`
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/oauth/registry.ts
git commit -m "feat(oauth): add provider registry and factory

- Type-safe provider factory with Platform enum
- Dynamic redirect URI generation
- Ready for future platform additions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Error Handling

### Task 5: Create OAuth Error Utilities

**Files:**
- Create: `lib/oauth/errors.ts`

**Step 1: Create error message handler with dev/prod split**

```typescript
// lib/oauth/errors.ts

export type OAuthErrorType =
  | 'user_cancelled'
  | 'invalid_code'
  | 'invalid_state'
  | 'no_organizations'
  | 'already_connected'
  | 'token_refresh_failed'
  | 'api_error'
  | 'unknown'

interface ErrorDetails {
  statusCode?: number
  message?: string
  error?: string
  description?: string
  endpoint?: string
  status?: number
  response?: any
  scopes?: string[]
  orgId?: string
  connectionId?: string
}

export function getErrorMessage(
  error: OAuthErrorType,
  details?: ErrorDetails
): string {
  const isDev = process.env.NODE_ENV === 'development'

  const messages: Record<
    OAuthErrorType,
    { user: string; dev: string }
  > = {
    user_cancelled: {
      user: 'LinkedIn connection cancelled',
      dev: 'User denied authorization at LinkedIn consent screen',
    },
    invalid_code: {
      user: 'Authorization failed. Please try again.',
      dev: `Token exchange failed: ${details?.statusCode} - ${details?.message}`,
    },
    invalid_state: {
      user: 'Security validation failed. Please try again.',
      dev: 'State token mismatch - possible CSRF attack',
    },
    no_organizations: {
      user: 'No LinkedIn organizations found. You need admin access to a company page.',
      dev: `fetchUserAccounts() returned empty array. Access token scopes: ${details?.scopes?.join(', ')}`,
    },
    already_connected: {
      user: 'This LinkedIn organization is already connected',
      dev: `Org ${details?.orgId} already connected to platform_connection ${details?.connectionId}`,
    },
    token_refresh_failed: {
      user: 'LinkedIn connection expired. Please reconnect.',
      dev: `Refresh token failed: ${details?.statusCode} - ${details?.error} - ${details?.description}`,
    },
    api_error: {
      user: 'Failed to connect to LinkedIn. Please try again.',
      dev: `API error at ${details?.endpoint}: ${details?.status} - ${JSON.stringify(details?.response)}`,
    },
    unknown: {
      user: 'An unexpected error occurred',
      dev: `Unknown error: ${JSON.stringify(details)}`,
    },
  }

  const errorMessages = messages[error] || messages.unknown

  return isDev && details
    ? errorMessages.dev || `Unknown error: ${error} - ${JSON.stringify(details)}`
    : errorMessages.user
}

export function sanitizeForLogging(data: any): any {
  const REDACTED_FIELDS = [
    'access_token',
    'refresh_token',
    'client_secret',
    'authorization_code',
    'code',
  ]

  const sanitized = { ...data }

  REDACTED_FIELDS.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  })

  return sanitized
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/oauth/errors.ts
git commit -m "feat(oauth): add error handling utilities

- Dev vs production error messages
- Sanitized logging for sensitive data
- Type-safe error types
- Comprehensive error scenarios

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: OAuth API Routes

### Task 6: Create OAuth Initiation Route

**Files:**
- Create: `app/api/auth/oauth/[provider]/route.ts`

**Step 1: Create OAuth initiation route**

```typescript
// app/api/auth/oauth/[provider]/route.ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Platform } from '@/lib/oauth/types'
import { getOAuthProvider, getRedirectUri } from '@/lib/oauth/registry'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params
    const platform = providerParam as Platform

    // Validate platform
    if (!Object.values(Platform).includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      )
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
    console.error('[OAuth Initiation Error]', {
      type: 'oauth_init_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })

    return redirect('/settings/integrations?error=unknown')
  }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Test route is accessible**

Run: `npm run dev`
Visit: `http://localhost:3000/api/auth/oauth/linkedin`
Expected: Should redirect (will fail without env vars, but route should work)

**Step 4: Commit**

```bash
git add app/api/auth/oauth/[provider]/route.ts
git commit -m "feat(oauth): add OAuth initiation route

- Dynamic route for all OAuth platforms
- State token generation and cookie storage
- Platform validation
- Redirect to provider authorization URL

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Create OAuth Callback Route (Part 1 - Setup and Validation)

**Files:**
- Create: `app/api/auth/oauth/[provider]/callback/route.ts`

**Step 1: Create callback route with error handling and state validation**

```typescript
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
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/auth/oauth/[provider]/callback/route.ts
git commit -m "feat(oauth): add OAuth callback route - validation

- State token validation (CSRF protection)
- Platform verification
- User denial handling
- Error handling and logging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Complete OAuth Callback Route (Part 2 - Token Exchange and Save)

**Files:**
- Modify: `app/api/auth/oauth/[provider]/callback/route.ts`

**Step 1: Add token exchange and connection saving**

Replace the comment `// Continue with token exchange in next step...` with:

```typescript
    // Get OAuth provider
    const provider = getOAuthProvider(platform)
    const redirectUri = getRedirectUri(platform)

    // Exchange code for tokens
    let tokens
    try {
      tokens = await provider.exchangeCodeForTokens(code, redirectUri)
    } catch (err) {
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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return redirect('/login')
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userRecord) {
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
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/auth/oauth/[provider]/callback/route.ts
git commit -m "feat(oauth): complete OAuth callback - token exchange and save

- Exchange authorization code for tokens
- Fetch user accounts from platform
- Check for duplicate connections
- Save credentials to database
- Success redirect with platform param

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Update LinkedIn Client

### Task 9: Update LinkedIn Types for OAuth

**Files:**
- Modify: `lib/platforms/linkedin/types.ts:57-60`

**Step 1: Update LinkedInCredentials interface**

Replace the existing interface:

```typescript
export interface LinkedInCredentials {
  access_token: string
  refresh_token: string
  expires_at: string // ISO 8601 timestamp
  organization_id: string
  organization_name: string
  scopes: string[]
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/platforms/linkedin/types.ts
git commit -m "feat(linkedin): update credentials type for OAuth

- Add refresh_token field
- Add expires_at for token expiration tracking
- Add organization_name for display
- Add scopes array for debugging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 10: Update LinkedIn Client with Auto-Refresh

**Files:**
- Modify: `lib/platforms/linkedin/client.ts`

**Step 1: Update client constructor and add auto-refresh**

Add to top of file:

```typescript
import { getOAuthProvider } from '@/lib/oauth/registry'
import { Platform } from '@/lib/oauth/types'
```

Update the class:

```typescript
export class LinkedInClient {
  private accessToken: string
  private organizationId: string
  private credentials: LinkedInCredentials
  private connectionId: string | null
  private oauthProvider: OAuthProvider | null

  constructor(credentials: LinkedInCredentials, connectionId?: string) {
    this.credentials = credentials
    this.accessToken = credentials.access_token
    this.organizationId = credentials.organization_id
    this.connectionId = connectionId || null
    this.oauthProvider =
      connectionId && credentials.refresh_token
        ? getOAuthProvider(Platform.LINKEDIN)
        : null
  }

  private async ensureFreshToken(): Promise<void> {
    // Skip refresh if no OAuth provider or connection ID
    if (!this.oauthProvider || !this.connectionId) {
      return
    }

    // Check if token needs refresh
    if (this.oauthProvider.shouldRefreshToken(this.credentials.expires_at)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[LinkedIn Client] Refreshing token', {
          expiresAt: this.credentials.expires_at,
          connectionId: this.connectionId,
        })
      }

      try {
        const newTokens = await this.oauthProvider.refreshAccessToken(
          this.credentials.refresh_token
        )

        await this.oauthProvider.updateTokensInDatabase(
          this.connectionId,
          newTokens
        )

        // Update local credentials
        this.credentials = {
          ...this.credentials,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: this.oauthProvider.calculateExpiresAt(
            newTokens.expires_in
          ),
        }
        this.accessToken = newTokens.access_token

        if (process.env.NODE_ENV === 'development') {
          console.log('[LinkedIn Client] Token refreshed successfully')
        }
      } catch (error) {
        console.error('[LinkedIn Client] Token refresh failed', {
          type: 'token_refresh_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })
        throw error
      }
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    await this.ensureFreshToken()

    const response = await fetch(`${LINKEDIN_API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    return response.json()
  }

  // Rest of the methods remain the same...
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: May have errors if `import { OAuthProvider }` is missing, add it

**Step 3: Add missing import**

```typescript
import type { OAuthProvider } from '@/lib/oauth/base'
```

**Step 4: Verify again**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/client.ts
git commit -m "feat(linkedin): add automatic token refresh to client

- Proactive token refresh before 7-day threshold
- Update credentials after refresh
- Graceful fallback for manual tokens
- Development logging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 11: Update LinkedIn Actions to Pass Connection ID

**Files:**
- Modify: `lib/platforms/linkedin/actions.ts:43`

**Step 1: Update syncLinkedInMetrics to pass connection ID**

Find this line:
```typescript
const adapter = new LinkedInAdapter(credentials)
```

Replace with:
```typescript
const adapter = new LinkedInAdapter(credentials, connection.id)
```

**Step 2: Update LinkedInAdapter constructor**

Modify: `lib/platforms/linkedin/adapter.ts:14-18`

```typescript
export class LinkedInAdapter {
  private client: LinkedInClient

  constructor(credentials: LinkedInCredentials, connectionId?: string) {
    this.client = new LinkedInClient(credentials, connectionId)
  }

  // Rest remains the same...
}
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/platforms/linkedin/actions.ts lib/platforms/linkedin/adapter.ts
git commit -m "feat(linkedin): pass connection ID for token refresh

- Adapter passes connection ID to client
- Actions passes connection ID to adapter
- Enables token refresh in sync operations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Update UI Components

### Task 12: Update Platform Connection Card for OAuth

**Files:**
- Modify: `components/settings/platform-connection-card.tsx`

**Step 1: Update Connect button to use OAuth**

Find the section that renders the LinkedInConnectDialog:

```typescript
{platformType === 'linkedin' ? (
  <LinkedInConnectDialog />
) : (
  <p className="text-sm text-muted-foreground">
    Connect {info.name} to track performance metrics.
  </p>
)}
```

Replace with:

```typescript
<Button
  onClick={() => {
    window.location.href = `/api/auth/oauth/${platformType}`
  }}
>
  Connect
</Button>
```

**Step 2: Remove LinkedInConnectDialog import**

Remove this line from top of file:
```typescript
import { LinkedInConnectDialog } from '@/components/integrations/linkedin-connect-dialog'
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/settings/platform-connection-card.tsx
git commit -m "feat(ui): update connection card to use OAuth flow

- Replace manual token dialog with OAuth redirect
- Generic button works for all platforms
- Remove LinkedIn-specific dialog import

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 13: Delete Manual Token Entry Dialog

**Files:**
- Delete: `components/integrations/linkedin-connect-dialog.tsx`

**Step 1: Delete the file**

```bash
rm components/integrations/linkedin-connect-dialog.tsx
```

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor(ui): remove manual LinkedIn token entry dialog

OAuth flow replaces manual token input

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: Toast Notifications

### Task 14: Add Toast Notifications to Integrations Page

**Files:**
- Modify: `app/settings/integrations/page.tsx`

**Step 1: Add toast handling for OAuth callback**

Add to top of file:

```typescript
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { showSuccess, showError } from '@/components/ui/sonner'
```

Wait, this page is a server component. We need to handle toasts differently.

**Step 1 (Revised): Create client wrapper for toast handling**

Create: `app/settings/integrations/oauth-toast-handler.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/components/ui/sonner'

export function OAuthToastHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    const platform = searchParams.get('platform')

    if (error) {
      showError(decodeURIComponent(error), {
        duration: Infinity,
        description: process.env.NODE_ENV === 'development' ? error : undefined,
      })
      // Clear error from URL
      router.replace('/settings/integrations')
    }

    if (success === 'connected' && platform) {
      const platformName =
        platform === 'linkedin'
          ? 'LinkedIn'
          : platform === 'google_analytics'
          ? 'Google Analytics'
          : platform
      showSuccess(`${platformName} connected successfully`, {
        duration: 5000,
      })
      // Clear success from URL
      router.replace('/settings/integrations')
    }
  }, [searchParams, router])

  return null
}
```

**Step 2: Add toast handler to integrations page**

Modify: `app/settings/integrations/page.tsx`

Add import at top:
```typescript
import { OAuthToastHandler } from './oauth-toast-handler'
```

Add component to return statement (before the div):
```typescript
return (
  <>
    <OAuthToastHandler />
    <div className="space-y-6">
      {/* existing content */}
    </div>
  </>
)
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/settings/integrations/oauth-toast-handler.tsx app/settings/integrations/page.tsx
git commit -m "feat(ui): add OAuth toast notifications

- Success toast after connection
- Error toasts with infinite duration
- URL cleanup after showing toast
- Dev mode shows full error details

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 8: Environment Variables

### Task 15: Add Environment Variables

**Files:**
- Modify: `.env.local`

**Step 1: Add LinkedIn OAuth credentials**

Add to `.env.local`:

```bash
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_app_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_app_client_secret
```

**Step 2: Verify variables are loaded**

Run: `npm run dev`
Check console for any errors about missing env vars

**Step 3: Add to .env.example (if it exists)**

If `.env.example` exists, add:

```bash
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
```

**Step 4: Commit**

```bash
git add .env.local
git commit -m "chore: add LinkedIn OAuth environment variables

Add placeholder credentials for OAuth flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 9: Testing and Verification

### Task 16: Manual Testing

**No files to modify - testing only**

**Step 1: Start development server**

Run: `npm run dev`

**Step 2: Test OAuth initiation**

1. Visit: `http://localhost:3000/settings/integrations`
2. Click "Connect" on LinkedIn card
3. Expected: Redirects to `/api/auth/oauth/linkedin`
4. Expected: Shows error (need real LinkedIn credentials)

**Step 3: Verify routes exist**

Check:
- `/api/auth/oauth/linkedin` exists
- `/api/auth/oauth/linkedin/callback` exists

**Step 4: Test with real credentials (if available)**

If you have LinkedIn app credentials:
1. Add to `.env.local`
2. Restart dev server
3. Click Connect → should redirect to LinkedIn
4. Approve → should redirect back and save connection

**Step 5: Check database**

After successful connection, verify:
```sql
SELECT * FROM platform_connections WHERE platform_type = 'linkedin';
```

Should show:
- `credentials` JSONB with `access_token`, `refresh_token`, `expires_at`, etc.
- `status` = 'active'

**Step 6: Document test results**

Create: `docs/testing/oauth-manual-test-results.md`

```markdown
# OAuth Manual Testing Results

Date: [Current Date]
Tester: Claude Code

## Test Cases

### OAuth Initiation
- [ ] Click Connect → redirects to LinkedIn
- [ ] State cookie is set
- [ ] Platform cookie is set

### OAuth Callback
- [ ] LinkedIn approval → successful redirect
- [ ] Credentials saved to database
- [ ] Success toast shown
- [ ] Connection status updated

### Error Handling
- [ ] User cancellation → error toast
- [ ] Invalid state → CSRF error
- [ ] No organizations → appropriate error
- [ ] Duplicate connection → error

### Token Refresh
- [ ] Manual expiration test (set expires_at to tomorrow)
- [ ] Sync triggers refresh
- [ ] New tokens saved
- [ ] Sync completes successfully
```

---

## Phase 10: Documentation

### Task 17: Update README with OAuth Setup

**Files:**
- Modify: `README.md`

**Step 1: Add OAuth setup section**

Add after the "Testing" section:

```markdown
## LinkedIn OAuth Setup

### Development

1. Create LinkedIn App at https://www.linkedin.com/developers/apps
2. Add redirect URL: `http://localhost:3000/api/auth/oauth/linkedin/callback`
3. Request scopes:
   - `r_organization_social`
   - `r_organization_admin`
   - `rw_organization_admin`
4. Add credentials to `.env.local`:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

### Production

1. Add production redirect URL: `https://selo-io.vercel.app/api/auth/oauth/linkedin/callback`
2. Add credentials to Vercel environment variables
3. Verify `NEXT_PUBLIC_SITE_URL` is set correctly
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add LinkedIn OAuth setup instructions

- Development and production setup
- Required scopes
- Redirect URL configuration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Implementation Complete!

### Summary

**17 Tasks Completed:**
1. ✅ OAuth types and Platform enum
2. ✅ OAuth base class
3. ✅ LinkedIn OAuth provider
4. ✅ OAuth provider registry
5. ✅ Error handling utilities
6. ✅ OAuth initiation route
7. ✅ OAuth callback route (validation)
8. ✅ OAuth callback route (token exchange)
9. ✅ LinkedIn credentials type update
10. ✅ LinkedIn client auto-refresh
11. ✅ Pass connection ID for refresh
12. ✅ Update connection card for OAuth
13. ✅ Delete manual token dialog
14. ✅ Add toast notifications
15. ✅ Environment variables
16. ✅ Manual testing
17. ✅ Documentation

**Features Delivered:**
- Generic OAuth infrastructure for all platforms
- LinkedIn OAuth 2.0 with refresh token
- Automatic token refresh (7-day threshold)
- CSRF protection via state tokens
- Comprehensive error handling
- Dev/prod error messages
- Toast notifications
- Security best practices

**Next Steps:**
- Add real LinkedIn app credentials
- Test full OAuth flow
- Deploy to production
- Add more OAuth providers (Google Analytics, Instagram, etc.)
