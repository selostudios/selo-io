/**
 * Redirect URL validation to prevent open redirect attacks.
 *
 * Only allows relative paths starting with '/'. Rejects anything containing
 * protocol markers, double slashes, or @ signs that could redirect to external domains.
 */

export function isValidRedirectPath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('://')) return false
  if (path.includes('@')) return false
  if (path.includes('\\')) return false
  return true
}

/**
 * Returns the path if it's a safe relative redirect, otherwise returns the fallback.
 */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!path) return fallback
  return isValidRedirectPath(path) ? path : fallback
}
