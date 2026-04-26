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
    <div className="bg-background fullscreen:hidden relative border-t">
      <TrayHandle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
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
