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
