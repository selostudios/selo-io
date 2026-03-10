'use client'

import { ScoreCard } from './score-cards'

interface UnifiedScoreCardsProps {
  overall: number | null
  seo: number | null
  performance: number | null
  aiReadiness: number | null
}

export function UnifiedScoreCards({
  overall,
  seo,
  performance,
  aiReadiness,
}: UnifiedScoreCardsProps) {
  return (
    <div className="flex gap-4">
      <ScoreCard
        label="Overall"
        score={overall}
        description="Weighted average: SEO (40%), Performance (30%), AI Readiness (30%)."
      />
      <ScoreCard
        label="SEO"
        score={seo}
        description="Search engine optimization: meta tags, headings, content, links, and crawlability."
      />
      <ScoreCard
        label="Performance"
        score={performance}
        description="Technical performance: page speed, security, mobile-friendliness, and Core Web Vitals."
      />
      <ScoreCard
        label="AI Readiness"
        score={aiReadiness}
        description="AI visibility: structured data, llms.txt, content citability, and platform readiness."
      />
    </div>
  )
}
