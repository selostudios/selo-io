'use client'

import { cn } from '@/lib/utils'
import { type ReactNode, type CSSProperties } from 'react'

interface SlideContainerProps {
  children: ReactNode
  variant?: 'dark' | 'light' | 'accent'
  className?: string
  style?: CSSProperties
}

const variantStyles = {
  dark: 'bg-slate-900 text-white',
  light: 'bg-white text-slate-900 dark:bg-slate-950 dark:text-white',
  accent: 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white',
}

export function SlideContainer({
  children,
  variant = 'light',
  className,
  style,
}: SlideContainerProps) {
  return (
    <div
      className={cn(
        'flex min-h-full w-full flex-col p-8 md:p-12 lg:p-16',
        // Only apply variant styles if no custom style is provided
        !style && variantStyles[variant],
        // Print styles
        'print:min-h-0 print:break-after-page print:p-8',
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
