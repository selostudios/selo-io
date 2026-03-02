'use client'

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from 'react'

const LAST_ORG_KEY = 'selo-last-organization-id'

interface OrgContextValue {
  orgId: string | null
  setOrgId: (id: string | null) => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

/** Read org from URL ?org= then fall back to localStorage. */
function getOrgFromBrowser(): string | null {
  const urlOrg = new URL(window.location.href).searchParams.get('org')
  if (urlOrg) return urlOrg
  return localStorage.getItem(LAST_ORG_KEY)
}

/** Subscribe to cross-tab localStorage changes for the org key. */
function subscribeToOrgChanges(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === LAST_ORG_KEY) callback()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

/** Server snapshot always returns null (no org during SSR). */
function getServerSnapshot(): string | null {
  return null
}

/**
 * Provides the current org ID from URL ?org= param or localStorage.
 * Wrap authenticated layouts with this so client-side navigation can
 * consistently include the org query parameter.
 */
export function OrgProvider({ children }: { children: ReactNode }) {
  // Hydrate from URL/localStorage without triggering the set-state-in-effect lint rule
  const hydratedOrg = useSyncExternalStore(
    subscribeToOrgChanges,
    getOrgFromBrowser,
    getServerSnapshot
  )

  // Local state allows imperative updates from setOrgId (e.g. OrgSelector)
  const [overrideOrg, setOverrideOrg] = useState<string | null | undefined>(undefined)

  // Override takes precedence when explicitly set; otherwise use hydrated value
  const orgId = overrideOrg !== undefined ? overrideOrg : hydratedOrg

  const setOrgId = useCallback((id: string | null) => {
    setOverrideOrg(id)
  }, [])

  return <OrgContext.Provider value={{ orgId, setOrgId }}>{children}</OrgContext.Provider>
}

/**
 * Returns the current org ID or null.
 * Safe to call outside OrgProvider (returns null).
 */
export function useOrgId(): string | null {
  const context = useContext(OrgContext)
  return context?.orgId ?? null
}

/**
 * Returns a setter to update the org ID in context.
 * Used by OrgSelector to keep context in sync with localStorage/cookie.
 * Safe to call outside OrgProvider (returns no-op).
 */
export function useSetOrgId(): (id: string | null) => void {
  const context = useContext(OrgContext)
  return context?.setOrgId ?? noop
}

const noop = () => {}

/**
 * Returns a function that appends ?org=<id> to a path when an org is selected.
 * Safe to call outside OrgProvider (returns identity function).
 */
export function useBuildOrgHref(): (path: string) => string {
  const context = useContext(OrgContext)
  const orgId = context?.orgId ?? null

  return useCallback(
    (path: string) => {
      if (!orgId) return path
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}org=${orgId}`
    },
    [orgId]
  )
}
