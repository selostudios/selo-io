'use client'

import { cn } from '@/lib/utils'
import type { CWVRating } from '@/lib/performance/types'

interface CoreWebVitalsProps {
  lcp: { value: number | null; rating: CWVRating | null }
  inp: { value: number | null; rating: CWVRating | null }
  cls: { value: number | null; rating: CWVRating | null }
}

function getRatingColor(rating: CWVRating | null): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'needs_improvement':
      return 'bg-orange-100 text-orange-700 border-orange-200'
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
  name: string
  value: string
  target: string
  rating: CWVRating | null
}

function MetricCard({ name, value, target, rating }: MetricCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', getRatingColor(rating))}>
      <div className="mb-1 text-sm font-medium opacity-80">{name}</div>
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
    <div className="grid gap-4 sm:grid-cols-3">
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
