'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
} from 'react'
import { setSlideVisibility } from '@/lib/reviews/actions'
import type { SlideKey } from '@/lib/reviews/slides/registry'
import { showError } from '@/components/ui/sonner'

interface HiddenSlidesContextValue {
  hiddenSlides: readonly SlideKey[]
  isHidden: (key: SlideKey) => boolean
  toggle: (key: SlideKey) => void
  isPending: boolean
}

const HiddenSlidesContext = createContext<HiddenSlidesContextValue | null>(null)

interface OptimisticAction {
  key: SlideKey
  hide: boolean
}

function reduceHidden(state: readonly SlideKey[], action: OptimisticAction): readonly SlideKey[] {
  if (action.hide) return state.includes(action.key) ? state : [...state, action.key]
  return state.filter((k) => k !== action.key)
}

export interface HiddenSlidesProviderProps {
  reviewId: string
  initialHidden: readonly SlideKey[]
  children: React.ReactNode
}

/**
 * Wraps a subtree so toggling a slide's visibility updates the dimming
 * appearance immediately (via `useOptimistic`) while the server action and
 * page revalidation finish in the background. Toggle controls and the
 * dimmed views (deck, tiles) read from the same optimistic snapshot so they
 * stay in sync without flicker.
 */
export function HiddenSlidesProvider({
  reviewId,
  initialHidden,
  children,
}: HiddenSlidesProviderProps) {
  const [optimisticHidden, applyOptimistic] = useOptimistic(initialHidden, reduceHidden)
  const [isPending, startTransition] = useTransition()

  const toggle = useCallback(
    (key: SlideKey) => {
      const willHide = !optimisticHidden.includes(key)
      startTransition(async () => {
        applyOptimistic({ key, hide: willHide })
        const result = await setSlideVisibility(reviewId, key, willHide)
        if (!result.success) showError(result.error)
      })
    },
    [optimisticHidden, applyOptimistic, reviewId]
  )

  const value = useMemo<HiddenSlidesContextValue>(
    () => ({
      hiddenSlides: optimisticHidden,
      isHidden: (k) => optimisticHidden.includes(k),
      toggle,
      isPending,
    }),
    [optimisticHidden, toggle, isPending]
  )

  return <HiddenSlidesContext.Provider value={value}>{children}</HiddenSlidesContext.Provider>
}

export function useHiddenSlides(): HiddenSlidesContextValue {
  const ctx = useContext(HiddenSlidesContext)
  if (!ctx) {
    throw new Error('useHiddenSlides must be used inside a <HiddenSlidesProvider>')
  }
  return ctx
}
