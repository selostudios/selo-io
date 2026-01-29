'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ScoreStatus } from '@/lib/enums'
import { getScoreStatus } from '@/lib/reports'

interface ScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  label?: string
  animate?: boolean
  className?: string
}

const sizeConfig = {
  sm: { dimension: 80, strokeWidth: 6, fontSize: 'text-xl', labelSize: 'text-xs' },
  md: { dimension: 120, strokeWidth: 8, fontSize: 'text-3xl', labelSize: 'text-sm' },
  lg: { dimension: 180, strokeWidth: 10, fontSize: 'text-5xl', labelSize: 'text-base' },
  xl: { dimension: 240, strokeWidth: 12, fontSize: 'text-7xl', labelSize: 'text-lg' },
}

const statusColors = {
  [ScoreStatus.Good]: {
    stroke: 'stroke-green-500',
    text: 'text-green-600 dark:text-green-400',
    bg: 'stroke-green-100 dark:stroke-green-900/50',
  },
  [ScoreStatus.NeedsImprovement]: {
    stroke: 'stroke-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-400',
    bg: 'stroke-yellow-100 dark:stroke-yellow-900/50',
  },
  [ScoreStatus.Poor]: {
    stroke: 'stroke-red-500',
    text: 'text-red-600 dark:text-red-400',
    bg: 'stroke-red-100 dark:stroke-red-900/50',
  },
}

export function ScoreRing({
  score,
  size = 'md',
  showLabel = false,
  label,
  animate = true,
  className,
}: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score)
  const config = sizeConfig[size]
  const status = getScoreStatus(score)
  const colors = statusColors[status]

  const radius = (config.dimension - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayScore / 100) * circumference

  // Animate score on mount - setState in effect is intentional for animation
  useEffect(() => {
    if (!animate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayScore(score)
      return
    }

    const duration = 1000 // 1 second
    const startTime = performance.now()

    const animateScore = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * score)

      setDisplayScore(current)

      if (progress < 1) {
        requestAnimationFrame(animateScore)
      }
    }

    requestAnimationFrame(animateScore)
  }, [score, animate])

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: config.dimension, height: config.dimension }}>
        <svg
          className="-rotate-90 transform"
          width={config.dimension}
          height={config.dimension}
        >
          {/* Background circle */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            className={colors.bg}
          />
          {/* Progress circle */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            className={cn(colors.stroke, 'transition-all duration-1000')}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold', config.fontSize, colors.text)}>
            {displayScore}
          </span>
          {showLabel && label && (
            <span className={cn('text-muted-foreground mt-1', config.labelSize)}>{label}</span>
          )}
        </div>
      </div>
    </div>
  )
}
