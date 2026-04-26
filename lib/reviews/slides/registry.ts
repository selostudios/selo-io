import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  BarChart3,
  Linkedin,
  Sparkles,
  Rocket,
  Lightbulb,
  Calendar,
} from 'lucide-react'
import type { NarrativeBlocks } from '@/lib/reviews/types'

export type SlideKey =
  | 'cover'
  | 'ga_summary'
  | 'linkedin_insights'
  | 'content_highlights'
  | 'initiatives'
  | 'takeaways'
  | 'planning'

export type SlideKind = 'cover' | 'ga' | 'linkedin' | 'content' | 'prose'

export interface SlideDefinition {
  key: SlideKey
  narrativeBlockKey: keyof NarrativeBlocks
  label: string
  icon: LucideIcon
  kind: SlideKind
  hideable: boolean
}

export const SLIDES: readonly SlideDefinition[] = [
  {
    key: 'cover',
    narrativeBlockKey: 'cover_subtitle',
    label: 'Cover',
    icon: LayoutDashboard,
    kind: 'cover',
    hideable: false,
  },
  {
    key: 'ga_summary',
    narrativeBlockKey: 'ga_summary',
    label: 'Google Analytics',
    icon: BarChart3,
    kind: 'ga',
    hideable: true,
  },
  {
    key: 'linkedin_insights',
    narrativeBlockKey: 'linkedin_insights',
    label: 'LinkedIn',
    icon: Linkedin,
    kind: 'linkedin',
    hideable: true,
  },
  {
    key: 'content_highlights',
    narrativeBlockKey: 'content_highlights',
    label: 'What Resonated',
    icon: Sparkles,
    kind: 'content',
    hideable: true,
  },
  {
    key: 'initiatives',
    narrativeBlockKey: 'initiatives',
    label: 'Initiatives',
    icon: Rocket,
    kind: 'prose',
    hideable: true,
  },
  {
    key: 'takeaways',
    narrativeBlockKey: 'takeaways',
    label: 'Takeaways',
    icon: Lightbulb,
    kind: 'prose',
    hideable: true,
  },
  {
    key: 'planning',
    narrativeBlockKey: 'planning',
    label: 'Planning Ahead',
    icon: Calendar,
    kind: 'prose',
    hideable: true,
  },
] as const

export function isSlideKey(value: string): value is SlideKey {
  return SLIDES.some((s) => s.key === value)
}

export function getSlide(key: SlideKey): SlideDefinition {
  const found = SLIDES.find((s) => s.key === key)
  if (!found) throw new Error(`Unknown slide key: ${key}`)
  return found
}
