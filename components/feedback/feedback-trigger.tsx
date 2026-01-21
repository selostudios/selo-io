'use client'

import { useEffect } from 'react'
import { useFeedback } from './feedback-provider'

export function FeedbackTrigger() {
  const { openFeedback } = useFeedback()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openFeedback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openFeedback])

  return null
}
