'use client'

import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface SlideContainerProps {
  children: ReactNode
  variant?: 'dark' | 'light' | 'accent'
  className?: string
}

const variantStyles = {
  dark: 'bg-slate-900 text-white',
  light: 'bg-white text-slate-900 dark:bg-slate-950 dark:text-white',
  accent: 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white',
}

export function SlideContainer({ children, variant = 'light', className }: SlideContainerProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen w-full flex-col',
        variantStyles[variant],
        // Print styles
        'print:min-h-0 print:break-after-page',
        className
      )}
    >
      {children}
    </div>
  )
}
