'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Extract the org ID from the current URL pathname.
 * Returns the first path segment if it's a UUID, null otherwise.
 */
export function useOrgId(): string | null {
  const pathname = usePathname()
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return firstSegment && UUID_REGEX.test(firstSegment) ? firstSegment : null
}

/**
 * Returns a function that prepends /{orgId} to a path.
 * If no org in URL, returns the path unchanged.
 */
export function useBuildOrgHref(): (path: string) => string {
  const orgId = useOrgId()

  return useCallback(
    (path: string) => {
      if (!orgId) return path
      if (path.startsWith(`/${orgId}`)) return path
      return `/${orgId}${path.startsWith('/') ? '' : '/'}${path}`
    },
    [orgId]
  )
}
