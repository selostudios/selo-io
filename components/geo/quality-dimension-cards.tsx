'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface QualityDimensionCardsProps {
  dataQuality: number
  expertCredibility: number
  comprehensiveness: number
  citability: number
  authority: number
}

const DIMENSION_DEFINITIONS = {
  'Data Quality': {
    description:
      'Are statistics meaningful and properly sourced? High-quality data includes specific numbers with clear attribution and methodology.',
  },
  'Expert Credibility': {
    description:
      'Are quotes from actual authorities with clear credentials? Real expert quotes include specific names, titles, and affiliations.',
  },
  Comprehensiveness: {
    description:
      'Does content thoroughly cover the topic? Comprehensive content addresses main topics, edge cases, and provides depth.',
  },
  Citability: {
    description:
      'Would AI engines actually cite this content? Citable content has clear, extractable statements that answer specific questions.',
  },
  Authority: {
    description:
      'E-E-A-T signals: Experience, Expertise, Authoritativeness, and Trustworthiness. Includes author credentials, recent updates, and trust indicators.',
  },
}

type Rating = 'good' | 'needs_improvement' | 'poor'

function getRatingFromScore(score: number): Rating {
  if (score >= 80) return 'good'
  if (score >= 60) return 'needs_improvement'
  return 'poor'
}

function getRatingColor(rating: Rating): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'needs_improvement':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'poor':
      return 'bg-red-100 text-red-700 border-red-200'
  }
}

function getRatingLabel(rating: Rating): string {
  switch (rating) {
    case 'good':
      return 'Good'
    case 'needs_improvement':
      return 'Needs Improvement'
    case 'poor':
      return 'Poor'
  }
}

interface DimensionCardProps {
  name: keyof typeof DIMENSION_DEFINITIONS
  score: number
}

function DimensionCard({ name, score }: DimensionCardProps) {
  const definition = DIMENSION_DEFINITIONS[name]
  const rating = getRatingFromScore(score)

  return (
    <div
      role="region"
      aria-label={`${name}: ${score}, ${getRatingLabel(rating)}`}
      className={cn('flex-1 rounded-lg border p-4', getRatingColor(rating))}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-sm font-medium opacity-80">{name}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="opacity-60 transition-opacity hover:opacity-100">
              <Info className="size-3.5" />
              <span className="sr-only">About {name}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs opacity-90">{definition.description}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mb-2 text-2xl font-bold tabular-nums">{score}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-70">Target: ≥ 80</span>
        <span className="font-medium">{getRatingLabel(rating)}</span>
      </div>
    </div>
  )
}

export function QualityDimensionCards({
  dataQuality,
  expertCredibility,
  comprehensiveness,
  citability,
  authority,
}: QualityDimensionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DimensionCard name="Data Quality" score={dataQuality} />
      <DimensionCard name="Expert Credibility" score={expertCredibility} />
      <DimensionCard name="Comprehensiveness" score={comprehensiveness} />
      <DimensionCard name="Citability" score={citability} />
      <DimensionCard name="Authority" score={authority} />
    </div>
  )
}
