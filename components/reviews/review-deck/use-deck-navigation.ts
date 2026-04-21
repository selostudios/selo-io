'use client'

import { useCallback, useEffect, useState } from 'react'

export interface UseDeckNavigationResult {
  currentIndex: number
  next: () => void
  prev: () => void
  goTo: (i: number) => void
  isFirst: boolean
  isLast: boolean
}

/**
 * Owns the current slide index for a review deck and wires up keyboard
 * navigation. Treats `slideCount === 0` as a degenerate "empty deck" where
 * both `isFirst` and `isLast` are true and every navigation method is a no-op.
 *
 * Keyboard shortcuts (handled on `window`):
 *   - ArrowRight / Space / PageDown → next slide
 *   - ArrowLeft  / PageUp          → previous slide
 *   - Home                         → first slide
 *   - End                          → last slide
 *
 * Shortcuts are ignored while focus is inside an input, textarea, or
 * contentEditable element so they don't hijack normal typing.
 */
export function useDeckNavigation(slideCount: number): UseDeckNavigationResult {
  const [currentIndex, setCurrentIndex] = useState(0)

  const maxIndex = Math.max(0, slideCount - 1)

  // When slideCount shrinks below the current index, clamp back into range
  // during render (React's recommended way to derive state from props without
  // a useEffect round-trip). This keeps `currentIndex` valid on the very next
  // render after `slideCount` changes.
  if (currentIndex > maxIndex) {
    setCurrentIndex(maxIndex)
  }

  const next = useCallback(() => {
    if (slideCount === 0) return
    setCurrentIndex((prev) => Math.min(prev + 1, slideCount - 1))
  }, [slideCount])

  const prev = useCallback(() => {
    if (slideCount === 0) return
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [slideCount])

  const goTo = useCallback(
    (i: number) => {
      if (slideCount === 0) return
      const floored = Math.floor(i)
      const clamped = Math.max(0, Math.min(slideCount - 1, floored))
      setCurrentIndex(clamped)
    },
    [slideCount]
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }

      switch (event.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          event.preventDefault()
          next()
          return
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault()
          prev()
          return
        case 'Home':
          event.preventDefault()
          goTo(0)
          return
        case 'End':
          event.preventDefault()
          goTo(slideCount - 1)
          return
        default:
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [next, prev, goTo, slideCount])

  const isFirst = slideCount === 0 ? true : currentIndex === 0
  const isLast = slideCount === 0 ? true : currentIndex === slideCount - 1

  return {
    currentIndex,
    next,
    prev,
    goTo,
    isFirst,
    isLast,
  }
}
