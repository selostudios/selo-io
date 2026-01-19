'use client'

import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number | null
  label: string
  size?: 'sm' | 'md' | 'lg'
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 90) return 'text-green-600'
  if (score >= 50) return 'text-orange-500'
  return 'text-red-600'
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'stroke-muted'
  if (score >= 90) return 'stroke-green-600'
  if (score >= 50) return 'stroke-orange-500'
  return 'stroke-red-600'
}

export function ScoreGauge({ score, label, size = 'md' }: ScoreGaugeProps) {
  const sizeClasses = {
    sm: 'size-16',
    md: 'size-24',
    lg: 'size-32',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8
  const radius = size === 'sm' ? 28 : size === 'md' ? 42 : 56
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? (score / 100) * circumference : 0

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative', sizeClasses[size])}>
        <svg className="size-full -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className={cn('transition-all duration-500', getScoreBgColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              'font-bold tabular-nums',
              textSizeClasses[size],
              getScoreColor(score)
            )}
          >
            {score !== null ? score : '—'}
          </span>
        </div>
      </div>
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
    </div>
  )
}
