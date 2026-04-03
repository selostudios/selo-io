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
  response?: unknown
  scopes?: string[]
  orgId?: string
  connectionId?: string
}

export function getErrorMessage(error: OAuthErrorType, details?: ErrorDetails): string {
  const isDev = process.env.NODE_ENV === 'development'

  const messages: Record<OAuthErrorType, { user: string; dev: string }> = {
    user_cancelled: {
      user: 'Connection cancelled.',
      dev: 'User denied authorization at consent screen',
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
      user: 'No accounts found. Make sure you have admin access to the account you want to connect.',
      dev: `fetchUserAccounts() returned empty array. Access token scopes: ${details?.scopes?.join(', ')}`,
    },
    already_connected: {
      user: 'This account is already connected.',
      dev: `Org ${details?.orgId} already connected to platform_connection ${details?.connectionId}`,
    },
    token_refresh_failed: {
      user: 'Connection expired. Please reconnect.',
      dev: `Refresh token failed: ${details?.statusCode} - ${details?.error} - ${details?.description}`,
    },
    api_error: {
      user: 'Failed to connect. Please try again.',
      dev: `API error at ${details?.endpoint}: ${details?.status} - ${JSON.stringify(details?.response)}`,
    },
    unknown: {
      user: 'Something went wrong. Please try again or contact your administrator.',
      dev: `Unknown error: ${JSON.stringify(details)}`,
    },
  }

  const errorMessages = messages[error] || messages.unknown

  return isDev && details
    ? errorMessages.dev || `Unknown error: ${error} - ${JSON.stringify(details)}`
    : errorMessages.user
}

export function sanitizeForLogging(data: unknown): unknown {
  const REDACTED_FIELDS = [
    'access_token',
    'refresh_token',
    'client_secret',
    'authorization_code',
    'code',
  ]

  function sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue)
    }

    if (typeof value === 'object') {
      const sanitized: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = REDACTED_FIELDS.includes(key) ? '[REDACTED]' : sanitizeValue(val)
      }
      return sanitized
    }

    return value
  }

  return sanitizeValue(data)
}
