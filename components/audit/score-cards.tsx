import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ScoreCardsProps {
  overall: number | null
  seo: number | null
  ai: number | null
  technical: number | null
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-muted/50'
  if (score >= 70) return 'bg-green-50'
  if (score >= 40) return 'bg-yellow-50'
  return 'bg-red-50'
}

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  return (
    <Card className={cn('transition-colors', getScoreBgColor(score))}>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <p className="text-muted-foreground mb-1 text-sm font-medium">{label}</p>
        <p className={cn('text-4xl font-bold tabular-nums', getScoreColor(score))}>
          {score !== null ? score : '-'}
        </p>
        <p className="text-muted-foreground text-sm">/100</p>
      </CardContent>
    </Card>
  )
}

export function ScoreCards({ overall, seo, ai, technical }: ScoreCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <ScoreCard label="Overall" score={overall} />
      <ScoreCard label="SEO" score={seo} />
      <ScoreCard label="AI Readiness" score={ai} />
      <ScoreCard label="Technical" score={technical} />
    </div>
  )
}
