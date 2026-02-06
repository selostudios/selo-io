'use client'

import { cn } from '@/lib/utils'

interface ProgressDotsProps {
  current: number
  total: number
  onNavigate?: (index: number) => void
  className?: string
  accentColor?: string | null
}

export function ProgressDots({
  current,
  total,
  onNavigate,
  className,
  accentColor,
}: ProgressDotsProps) {
  const activeBg = accentColor || undefined

  return (
    <div
      className={cn(
        'absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 gap-2 print:hidden',
        className
      )}
    >
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onNavigate?.(index)}
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            index === current
              ? `w-8 ${!activeBg ? 'bg-indigo-600 dark:bg-indigo-500' : ''}`
              : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'
          )}
          style={index === current && activeBg ? { backgroundColor: activeBg } : undefined}
          aria-label={`Go to slide ${index + 1}`}
          aria-current={index === current ? 'step' : undefined}
        />
      ))}
    </div>
  )
}
