# LinkedIn OAuth 2.0 with Refresh Token Design

**Date:** January 4, 2026
**Status:** Design Approved

## Overview

Replace manual LinkedIn token entry with proper OAuth 2.0 flow that includes refresh token support and automatic token lifecycle management. Build as generic OAuth infrastructure to support future platforms (Google Analytics, Instagram, Meta, HubSpot).

## Goals

- Remove manual access token entry (OAuth only)
- Automatic token refresh before expiration (proactive, 7-day threshold)
- Auto-detect LinkedIn organization ID
- Generic OAuth base that works for all platforms
- Support local development and production environments

## OAuth Flow Architecture

### User Flow

1. **User initiates**: Clicks "Connect LinkedIn" in Settings → Integrations
2. **Authorization**: Redirect to LinkedIn with client_id, scopes, and state token
3. **User approves**: LinkedIn shows permission screen, user accepts
4. **Callback**: LinkedIn redirects back with authorization code
5. **Token exchange**: Server exchanges code for access_token + refresh_token
6. **Fetch organization**: Call LinkedIn API to get user's organizations
7. **Store credentials**: Save tokens, expiration, org ID to database
8. **Success**: Redirect to integrations page with success toast

### Token Refresh Strategy (Proactive)

Before each LinkedIn API call:
- Check if `expires_at` is within 7 days
- If yes: Use `refresh_token` to get new `access_token` + new `refresh_token`
- Update database with new tokens and expiration
- Proceed with API call using fresh token

### Benefits

- Users never manually handle tokens
- Automatic organization ID detection
- Tokens refresh before expiration (no failed syncs)
- More secure (tokens never exposed to users)
- Refresh token rotation (new refresh_token on each refresh)

## Platform Type Safety

### Platform Enum

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
```

All OAuth operations use `Platform` enum, not strings.

## Database Schema

### Credentials Structure (JSONB)

**Current structure:**
```json
{
  "access_token": "...",
  "organization_id": "9319081"
}
```

**New OAuth structure:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": "2026-03-15T10:30:00Z",
  "organization_id": "9319081",
  "organization_name": "Selo Studios",
  "scopes": ["r_organization_social", "r_organization_admin", "rw_organization_admin"]
}
```

**New fields:**
- `refresh_token` - Used to get new access tokens
- `expires_at` - ISO timestamp when access_token expires (60 days from issue)
- `organization_name` - Human-readable org name (fetched automatically)
- `scopes` - Array of granted permissions for debugging

### Migration Approach

- No schema changes needed (already JSONB)
- Existing manual tokens continue working
- OAuth tokens have additional fields
- When manual token support is removed, existing connections show "Reconnect with OAuth" banner

### Connection Status States

```typescript
type ConnectionStatus =
  | 'active'        // Working normally
  | 'error'         // Token refresh failed, needs reconnection
  | 'disconnected'  // User manually disconnected
```

### Environment Variables

Add to `.env.local` and Vercel:
```
LINKEDIN_CLIENT_ID=your_app_client_id
LINKEDIN_CLIENT_SECRET=your_app_client_secret
```

## Generic OAuth Architecture

### Base OAuth Provider

**`lib/oauth/base.ts`** - Abstract OAuth provider base class

```typescript
abstract class OAuthProvider {
  abstract platform: Platform
  abstract getAuthorizationUrl(state: string, redirectUri: string): string
  abstract exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse>
  abstract refreshAccessToken(refreshToken: string): Promise<TokenResponse>
  abstract fetchUserAccounts(accessToken: string): Promise<Account[]>

  // Shared utilities
  generateState(): string
  shouldRefreshToken(expiresAt: string): boolean
  updateTokensInDatabase(connectionId: string, tokens: TokenResponse): Promise<void>
}
```

### Platform Providers

**`lib/oauth/providers/linkedin.ts`** - LinkedIn-specific implementation
- Extends `OAuthProvider`
- Implements LinkedIn-specific URLs, scopes, and API calls
- `getAuthorizationUrl()` → `https://www.linkedin.com/oauth/v2/authorization`
- `exchangeCodeForTokens()` → `https://www.linkedin.com/oauth/v2/accessToken`
- `fetchUserAccounts()` → LinkedIn organizations API

**`lib/oauth/providers/google.ts`** - Google Analytics (future)
- Extends `OAuthProvider`
- Google-specific OAuth endpoints and Analytics properties API

**`lib/oauth/providers/meta.ts`** - Instagram/Facebook (future)
- Extends `OAuthProvider`
- Meta-specific OAuth and account selection

### Provider Registry

**`lib/oauth/registry.ts`** - Provider factory

```typescript
import { Platform } from './types'
import { LinkedInOAuthProvider } from './providers/linkedin'

const providers = {
  [Platform.LINKEDIN]: LinkedInOAuthProvider,
  // [Platform.GOOGLE_ANALYTICS]: GoogleOAuthProvider,
  // [Platform.INSTAGRAM]: MetaOAuthProvider,
} as const

export function getOAuthProvider(platform: Platform): OAuthProvider {
  const ProviderClass = providers[platform]
  if (!ProviderClass) {
    throw new Error(`OAuth provider not found for platform: ${platform}`)
  }
  return new ProviderClass()
}
```

## LinkedIn OAuth Implementation

### LinkedIn Provider Details

**`lib/oauth/providers/linkedin.ts`:**

```typescript
export class LinkedInOAuthProvider extends OAuthProvider {
  platform = Platform.LINKEDIN

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      state: state,
      scope: 'r_organization_social r_organization_admin rw_organization_admin'
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string) {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      })
    })

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in, // 60 days in seconds
      scopes: data.scope.split(' ')
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      })
    })

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token, // LinkedIn returns new refresh token
      expires_in: data.expires_in
    }
  }

  async fetchUserAccounts(accessToken: string) {
    // Get organizations user has admin access to
    const response = await fetch(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName,id)))',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    )

    const data = await response.json()
    return data.elements.map(el => ({
      id: el['organization~'].id.toString(),
      name: el['organization~'].localizedName
    }))
  }
}
```

### Required Scopes

- `r_organization_social` - Read organization posts and engagement
- `r_organization_admin` - Read organization page stats
- `rw_organization_admin` - Required for some metrics endpoints

## API Routes

### OAuth Initiation

**`app/api/auth/oauth/[provider]/route.ts`** - Works for all platforms

```typescript
export async function GET(
  request: Request,
  { params }: { params: { provider: string } }
) {
  const platform = params.provider as Platform
  const provider = getOAuthProvider(platform)

  const state = provider.generateState()
  const redirectUri = getRedirectUri(platform)
  const authUrl = provider.getAuthorizationUrl(state, redirectUri)

  // Store state in httpOnly cookie
  cookies().set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/'
  })

  return redirect(authUrl)
}
```

### OAuth Callback

**`app/api/auth/oauth/[provider]/callback/route.ts`** - Works for all platforms

```typescript
export async function GET(
  request: Request,
  { params }: { params: { provider: string } }
) {
  const platform = params.provider as Platform
  const provider = getOAuthProvider(platform)

  // Get callback params
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle user denial
  if (error === 'user_cancelled_authorize') {
    return redirect('/settings/integrations?error=cancelled')
  }

  // Validate state (CSRF protection)
  const storedState = cookies().get('oauth_state')?.value
  if (!storedState || storedState !== state) {
    return redirect('/settings/integrations?error=invalid_state')
  }
  cookies().delete('oauth_state')

  // Exchange code for tokens
  const redirectUri = getRedirectUri(platform)
  const tokens = await provider.exchangeCodeForTokens(code!, redirectUri)

  // Fetch user's organizations/accounts
  const accounts = await provider.fetchUserAccounts(tokens.access_token)

  if (accounts.length === 0) {
    return redirect('/settings/integrations?error=no_accounts')
  }

  // If multiple accounts, show selection UI (future)
  // For now, auto-select first account
  const selectedAccount = accounts[0]

  // Check if already connected
  const existing = await checkExistingConnection(platform, selectedAccount.id)
  if (existing) {
    return redirect('/settings/integrations?error=already_connected')
  }

  // Save connection
  await saveConnection({
    platform,
    credentials: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: calculateExpiresAt(tokens.expires_in),
      organization_id: selectedAccount.id,
      organization_name: selectedAccount.name,
      scopes: tokens.scopes
    }
  })

  return redirect('/settings/integrations?success=connected')
}
```

## Redirect URIs

### Environment Support

- **Local**: `http://localhost:3000/api/auth/oauth/linkedin/callback`
- **Production**: `https://selo-io.vercel.app/api/auth/oauth/linkedin/callback`
- **Staging** (future): Easily add by setting environment variable

All URLs must be added to LinkedIn app's "Authorized redirect URLs" in developer portal.

### Dynamic Redirect URI Generation

```typescript
function getRedirectUri(platform: Platform): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/oauth/${platform}/callback`
}
```

## Updated Components

### Platform Connection Card

**`components/settings/platform-connection-card.tsx`** - Update

Remove manual token dialog, replace with OAuth redirect:

```typescript
// "Connect" button
<Button
  onClick={() => window.location.href = `/api/auth/oauth/${platformType}`}
>
  Connect
</Button>
```

Works for any platform: `linkedin`, `google_analytics`, `instagram`

### Remove Manual Token Entry

**`components/integrations/linkedin-connect-dialog.tsx`** - DELETE

No longer needed with OAuth flow.

## Updated Platform Client

### LinkedIn Client with Auto-Refresh

**`lib/platforms/linkedin/client.ts`** - Update

```typescript
export class LinkedInClient {
  private credentials: LinkedInCredentials
  private connectionId: string
  private oauthProvider: OAuthProvider

  constructor(credentials: LinkedInCredentials, connectionId: string) {
    this.credentials = credentials
    this.connectionId = connectionId
    this.oauthProvider = getOAuthProvider(Platform.LINKEDIN)
  }

  private async ensureFreshToken() {
    if (this.oauthProvider.shouldRefreshToken(this.credentials.expires_at)) {
      const newTokens = await this.oauthProvider.refreshAccessToken(
        this.credentials.refresh_token
      )
      await this.oauthProvider.updateTokensInDatabase(this.connectionId, newTokens)
      this.credentials = { ...this.credentials, ...newTokens }
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    await this.ensureFreshToken()

    const response = await fetch(`${LINKEDIN_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    return response.json()
  }
}
```

### Updated Credentials Type

**`lib/platforms/linkedin/types.ts`** - Update

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

## Error Handling

### OAuth Flow Errors

**1. User Denies Permission**
- LinkedIn redirects with `?error=user_cancelled_authorize`
- Redirect to `/settings/integrations` with toast: "LinkedIn connection cancelled"

**2. Invalid/Expired Authorization Code**
- Token exchange returns 400
- Redirect with toast: "Authorization failed. Please try again."

**3. Invalid State Token (CSRF)**
- State doesn't match stored state
- Redirect with toast: "Security validation failed. Please try again."
- Log security event

**4. User Has No Organizations**
- `fetchUserAccounts()` returns empty array
- Redirect with toast: "No LinkedIn organizations found. You need admin access to a company page."

**5. Already Connected Organization**
- Check if org_id exists in `platform_connections`
- Show toast: "This LinkedIn organization is already connected"

**6. Token Refresh Failure**
- Refresh token expired or revoked
- Update `platform_connections.status` to `'error'`
- Connection card shows orange warning: "Reconnect LinkedIn"

**7. Network/API Failures**
- Wrap all API calls in try/catch
- Retry with exponential backoff (3 attempts)
- Redirect with specific error message

### Development vs Production Error Messages

```typescript
// lib/oauth/errors.ts
export function getErrorMessage(error: string, details?: any) {
  const isDev = process.env.NODE_ENV === 'development'

  const messages = {
    user_cancelled: {
      user: 'LinkedIn connection cancelled',
      dev: 'User denied authorization at LinkedIn consent screen'
    },
    invalid_code: {
      user: 'Authorization failed. Please try again.',
      dev: `Token exchange failed: ${details?.statusCode} - ${details?.message}`
    },
    no_organizations: {
      user: 'No LinkedIn organizations found. You need admin access to a company page.',
      dev: `fetchUserAccounts() returned empty array. Access token scopes: ${details?.scopes}`
    },
    token_refresh_failed: {
      user: 'LinkedIn connection expired. Please reconnect.',
      dev: `Refresh token failed: ${details?.statusCode} - ${details?.error} - ${details?.description}`
    },
    api_error: {
      user: 'Failed to connect to LinkedIn. Please try again.',
      dev: `API error at ${details?.endpoint}: ${details?.status} - ${JSON.stringify(details?.response)}`
    }
  }

  return isDev && details
    ? messages[error]?.dev || `Unknown error: ${error} - ${JSON.stringify(details)}`
    : messages[error]?.user || 'An unexpected error occurred'
}
```

### Development Logging

All OAuth operations log detailed info in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[LinkedIn OAuth] Token exchange response:', {
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
    scopes: data.scope,
    rawResponse: data
  })
}
```

### Toast Behavior

```typescript
// Success toasts: auto-dismiss after 5 seconds
showSuccess('LinkedIn connected successfully', {
  duration: 5000
})

// Error toasts: NEVER auto-dismiss (must be manually closed)
showError(errorMessage, {
  description: isDev ? errorDetails : undefined,
  duration: Infinity
})
```

## Security Considerations

### CSRF Protection (State Token)

```typescript
import { randomBytes } from 'crypto'

function generateState(): string {
  return randomBytes(32).toString('hex')
}

// Store state in httpOnly cookie (not localStorage)
cookies().set('oauth_state', state, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 600, // 10 minutes
  path: '/'
})

// Validate in callback
const storedState = cookies().get('oauth_state')?.value
if (!storedState || storedState !== callbackState) {
  throw new Error('Invalid state token - possible CSRF attack')
}
cookies().delete('oauth_state')
```

### Client Secret Protection

- ✅ Store in environment variables only
- ✅ Never expose to client-side code
- ✅ Token exchange happens server-side only
- ❌ Never log client secret
- ❌ Never include in client-accessible API routes

### Token Storage

Current: Plaintext JSONB in `platform_connections.credentials`

Future (production): Encrypt using pgcrypto
```sql
-- Encrypt before storing
SELECT pgp_sym_encrypt(credentials::text, encryption_key)

-- Decrypt when reading
SELECT pgp_sym_decrypt(encrypted_credentials, encryption_key)
```

### HTTPS Requirements

- Production OAuth callbacks MUST use HTTPS
- LinkedIn rejects HTTP redirect URIs for production apps
- Local development: HTTP allowed for `localhost`

### Refresh Token Rotation

LinkedIn supports refresh token rotation:
- Each refresh returns new `access_token` AND new `refresh_token`
- Old `refresh_token` becomes invalid
- Always update both tokens in database after refresh

### Rate Limiting

```typescript
// Prevent OAuth abuse
// Max 5 connection attempts per user per hour
const RATE_LIMIT = 5
const WINDOW = 3600 // seconds

const attempts = await getOAuthAttempts(userId, WINDOW)
if (attempts >= RATE_LIMIT) {
  return { error: 'Too many connection attempts. Try again in 1 hour.' }
}
```

### Sensitive Data Logging

```typescript
const REDACTED_FIELDS = [
  'access_token',
  'refresh_token',
  'client_secret',
  'authorization_code'
]

function sanitizeForLogging(data: any) {
  const sanitized = { ...data }
  REDACTED_FIELDS.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  })
  return sanitized
}

console.log('[OAuth Response]', sanitizeForLogging(response))
```

### Security Checklist

- ✅ State token validation (CSRF)
- ✅ httpOnly cookies for state storage
- ✅ Server-side token exchange only
- ✅ HTTPS in production
- ✅ Refresh token rotation
- ✅ Rate limiting OAuth attempts
- ✅ Sanitized logging
- ⚠️ Token encryption (TODO for production)

## Testing Strategy

### Manual Testing Checklist

**OAuth Flow:**
- [ ] Click "Connect LinkedIn" → redirects to LinkedIn
- [ ] LinkedIn shows correct app name and scopes
- [ ] Approve → redirects back with success toast
- [ ] Connection card shows "Connected" with org name
- [ ] Deny → redirects with error toast
- [ ] Start flow twice → second attempt works

**Token Refresh:**
- [ ] Set `expires_at` to tomorrow in database
- [ ] Trigger LinkedIn sync
- [ ] Verify new tokens saved
- [ ] Verify `expires_at` updated to ~60 days out
- [ ] Sync succeeds with refreshed token

**Error Cases:**
- [ ] Invalid client_id → shows error with details in dev
- [ ] Invalid state → shows CSRF error
- [ ] User has no LinkedIn orgs → shows error
- [ ] Connect same org twice → shows "already connected"
- [ ] Token refresh fails → status set to 'error'

**Multi-Environment:**
- [ ] Local: `http://localhost:3000` callback works
- [ ] Production: `https://selo-io.vercel.app` callback works

### Unit Tests (Future)

```typescript
// tests/unit/lib/oauth/providers/linkedin.test.ts
describe('LinkedInOAuthProvider', () => {
  it('generates correct authorization URL')
  it('should refresh token when expires_at < 7 days')
  it('should not refresh when expires_at > 7 days')
})
```

### Integration Tests (Future)

```typescript
// tests/integration/oauth-flow.test.ts
describe('LinkedIn OAuth Flow', () => {
  it('completes full OAuth flow with mock LinkedIn')
})
```

### Development Testing Tools

```typescript
// app/api/dev/oauth-test/route.ts (dev only)
// Simulate OAuth callback without real LinkedIn
// Generate fake tokens for testing
```

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/oauth/base.ts` | Abstract OAuth provider base class |
| `lib/oauth/types.ts` | Platform enum and shared types |
| `lib/oauth/registry.ts` | Provider factory |
| `lib/oauth/providers/linkedin.ts` | LinkedIn OAuth implementation |
| `lib/oauth/errors.ts` | Error message handling (dev/prod) |
| `app/api/auth/oauth/[provider]/route.ts` | OAuth initiation (dynamic) |
| `app/api/auth/oauth/[provider]/callback/route.ts` | OAuth callback (dynamic) |
| `lib/platforms/linkedin/client.ts` | Update with auto-refresh |
| `lib/platforms/linkedin/types.ts` | Update credentials interface |
| `components/settings/platform-connection-card.tsx` | Update Connect button |

**Files to DELETE:**
- `components/integrations/linkedin-connect-dialog.tsx` - Manual token entry removed

## Future Enhancements

- Multi-account selection UI (when user has multiple orgs)
- Token encryption with pgcrypto
- Google Analytics OAuth provider
- Instagram/Meta OAuth provider
- HubSpot OAuth provider
- Background job to proactively refresh tokens daily
- Webhook support for token revocation events
- Admin dashboard showing all platform connections
