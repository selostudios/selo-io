'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TrayHandle } from './tray-handle'

export interface SlideTrayProps {
  children: React.ReactNode
  /** Whether the tray starts expanded. Defaults to true. */
  defaultExpanded?: boolean
}

export function SlideTray({ children, defaultExpanded = true }: SlideTrayProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-background fullscreen:hidden fixed right-0 bottom-0 left-0 z-40 border-t">
      <TrayHandle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      <div data-testid="tray-body" className={cn('p-4', !expanded && 'hidden')}>
        {children}
      </div>
    </div>
  )
}
