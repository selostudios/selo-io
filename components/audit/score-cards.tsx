'use client'

import { useSyncExternalStore } from 'react'
import { Info } from 'lucide-react'
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Use useSyncExternalStore to detect client-side rendering without triggering cascading renders
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

function useIsClient() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

interface ScoreCardsProps {
  overall: number | null
  seo: number | null
  ai: number | null
  technical: number | null
}

interface ScoreCardProps {
  label: string
  score: number | null
  description?: string
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'hsl(var(--muted-foreground))'
  if (score >= 70) return 'hsl(142, 76%, 36%)' // green-600
  if (score >= 40) return 'hsl(45, 92%, 39%)' // yellow-700 (matches warning pill)
  return 'hsl(0, 84%, 60%)' // red-600
}

function getScoreTextClass(score: number | null): string {
  if (score === null) return 'fill-muted-foreground'
  if (score >= 70) return 'fill-green-600'
  if (score >= 40) return 'fill-yellow-700'
  return 'fill-red-600'
}

export function ScoreCard({ label, score, description }: ScoreCardProps) {
  const isClient = useIsClient()

  const displayScore = score ?? 0
  // Calculate end angle: start at top (90°), go clockwise
  const endAngle = 90 - (displayScore / 100) * 360

  const chartData = [{ name: label, value: displayScore, fill: getScoreColor(score) }]

  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border bg-gray-100 py-4">
      <div className="flex h-[100px] w-[100px] items-center justify-center">
        {isClient ? (
          <RadialBarChart
            width={100}
            height={100}
            data={chartData}
            startAngle={90}
            endAngle={endAngle}
            innerRadius={35}
            outerRadius={48}
            cx="50%"
            cy="50%"
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-gray-100"
              polarRadius={[38, 32]}
            />
            <RadialBar
              dataKey="value"
              background={{ fill: 'hsl(var(--muted))' }}
              cornerRadius={5}
            />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={58} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          y={58}
                          className={`text-xl font-bold ${getScoreTextClass(score)}`}
                        >
                          {score !== null ? score : '-'}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        ) : (
          <div className="text-muted-foreground text-xl font-bold">
            {score !== null ? score : '-'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100">
                <Info className="size-3.5" />
                <span className="sr-only">What is {label}?</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium">{label}</p>
              <p className="mt-1 text-xs opacity-90">{description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export function ScoreCards({ overall, seo, ai, technical }: ScoreCardsProps) {
  return (
    <div className="flex gap-4">
      <ScoreCard
        label="Overall"
        score={overall}
        description="A weighted average of SEO, AI Readiness, and Technical scores. Represents the overall health of your website."
      />
      <ScoreCard
        label="SEO"
        score={seo}
        description="Measures search engine optimization factors including meta tags, headings, content structure, and internal linking."
      />
      <ScoreCard
        label="AI Readiness"
        score={ai}
        description="Evaluates how well your content is structured for AI systems and LLMs, including schema markup, clear content hierarchy, and machine-readable data."
      />
      <ScoreCard
        label="Technical"
        score={technical}
        description="Assesses technical aspects like page speed, mobile-friendliness, security headers, and proper HTML structure."
      />
    </div>
  )
}
