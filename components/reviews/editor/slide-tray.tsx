'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { TrayHandle } from './tray-handle'

export interface SlideTrayProps {
  children: React.ReactNode
  /** Initial open/closed state used on first paint, before any persisted preference loads. Defaults to true. */
  defaultExpanded?: boolean
}

const STORAGE_KEY = 'slide-tray:expanded'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function subscribe(onChange: () => void) {
  // Listen for cross-tab updates and our own dispatched events so multiple
  // tray instances on screen stay in sync.
  window.addEventListener('storage', onChange)
  window.addEventListener('slide-tray:storage', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('slide-tray:storage', onChange)
  }
}

export function SlideTray({ children, defaultExpanded = true }: SlideTrayProps) {
  // useSyncExternalStore syncs with localStorage without triggering the
  // set-state-in-effect lint rule. The server snapshot returns the default so
  // SSR hydration matches; on the client, the first render after hydration
  // picks up the persisted preference and survives navigation between
  // sibling slides (each navigation remounts this component because the
  // page is force-dynamic).
  const expanded = useSyncExternalStore(
    subscribe,
    () => {
      const stored = readStored()
      if (stored === 'true') return true
      if (stored === 'false') return false
      return defaultExpanded
    },
    () => defaultExpanded
  )

  const toggle = useCallback(() => {
    const next = !expanded
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
      window.dispatchEvent(new Event('slide-tray:storage'))
    } catch {
      // Persistence is best-effort; if storage fails the toggle just won't
      // survive navigation, which is degraded but not broken.
    }
  }, [expanded])

  return (
    <div className="bg-background fullscreen:hidden relative border-t">
      <TrayHandle expanded={expanded} onToggle={toggle} />
      <div
        data-testid="tray-body"
        className={cn(
          'bg-background absolute right-0 bottom-full left-0 z-10 max-h-[60vh] overflow-y-auto border-t p-4 shadow-lg',
          !expanded && 'hidden'
        )}
      >
        {children}
      </div>
    </div>
  )
}
