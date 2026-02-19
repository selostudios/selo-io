import { cookies } from 'next/headers'

const SELO_ORG_COOKIE = 'selo-org'

/**
 * Resolve the active organization ID on the server.
 *
 * Priority:
 *   1. URL `?org=` search param (explicit navigation)
 *   2. `selo-org` cookie (persisted last selection)
 *   3. User's assigned organization (fallback)
 *
 * External users always use their assigned org (ignore cookie/URL).
 */
export async function resolveOrganizationId(
  urlOrgId: string | undefined,
  userOrgId: string | null,
  isInternal: boolean
): Promise<string | null> {
  // External users: always their own org
  if (!isInternal) {
    return userOrgId
  }

  // Internal users: URL param first
  if (urlOrgId) {
    return urlOrgId
  }

  // Then cookie
  const cookieStore = await cookies()
  const cookieOrgId = cookieStore.get(SELO_ORG_COOKIE)?.value
  if (cookieOrgId) {
    return cookieOrgId
  }

  // Fallback to user's assigned org
  return userOrgId
}
