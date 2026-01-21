'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { CWVRating } from '@/lib/performance/types'

interface CoreWebVitalsProps {
  lcp: { value: number | null; rating: CWVRating | null }
  inp: { value: number | null; rating: CWVRating | null }
  cls: { value: number | null; rating: CWVRating | null }
}

const METRIC_DEFINITIONS = {
  LCP: {
    name: 'Largest Contentful Paint',
    description:
      'Measures loading performance. LCP marks the point when the main content has likely loaded. A good LCP is 2.5 seconds or less.',
  },
  INP: {
    name: 'Interaction to Next Paint',
    description:
      'Measures responsiveness. INP observes all interactions and reports a single value that represents the overall responsiveness. A good INP is 200 milliseconds or less.',
  },
  CLS: {
    name: 'Cumulative Layout Shift',
    description:
      "Measures visual stability. CLS quantifies how much a page's content shifts unexpectedly. A good CLS score is 0.1 or less.",
  },
}

function getRatingColor(rating: CWVRating | null): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'needs_improvement':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'poor':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-muted text-muted-foreground border-muted'
  }
}

function getRatingLabel(rating: CWVRating | null): string {
  switch (rating) {
    case 'good':
      return 'Good'
    case 'needs_improvement':
      return 'Needs Improvement'
    case 'poor':
      return 'Poor'
    default:
      return 'No Data'
  }
}

interface MetricCardProps {
  name: 'LCP' | 'INP' | 'CLS'
  value: string
  target: string
  rating: CWVRating | null
}

function MetricCard({ name, value, target, rating }: MetricCardProps) {
  const definition = METRIC_DEFINITIONS[name]

  return (
    <div
      role="region"
      aria-label={`${name}: ${value}, ${getRatingLabel(rating)}, target ${target}`}
      className={cn('flex-1 rounded-lg border p-4', getRatingColor(rating))}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-sm font-medium opacity-80">{name}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="opacity-60 transition-opacity hover:opacity-100">
              <Info className="size-3.5" />
              <span className="sr-only">What is {name}?</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium">{definition.name}</p>
            <p className="mt-1 text-xs opacity-90">{definition.description}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mb-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-70">Target: {target}</span>
        <span className="font-medium">{getRatingLabel(rating)}</span>
      </div>
    </div>
  )
}

export function CoreWebVitals({ lcp, inp, cls }: CoreWebVitalsProps) {
  return (
    <div className="flex gap-4">
      <MetricCard
        name="LCP"
        value={lcp.value !== null ? `${(lcp.value / 1000).toFixed(1)}s` : '—'}
        target="< 2.5s"
        rating={lcp.rating}
      />
      <MetricCard
        name="INP"
        value={inp.value !== null ? `${inp.value}ms` : '—'}
        target="< 200ms"
        rating={inp.rating}
      />
      <MetricCard
        name="CLS"
        value={cls.value !== null ? cls.value.toFixed(3) : '—'}
        target="< 0.1"
        rating={cls.rating}
      />
    </div>
  )
}
