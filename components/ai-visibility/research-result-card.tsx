'use client'

import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { ResearchResult } from '@/lib/ai-visibility/research'

interface ResearchResultCardProps {
  result: ResearchResult
  onSaveToMonitoring?: () => void
}

export function ResearchResultCard({ result, onSaveToMonitoring }: ResearchResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const snippet = result.response_text.slice(0, 200)
  const hasMore = result.response_text.length > 200

  return (
    <Card data-testid="research-result-card">
      <CardContent className="space-y-3 p-4">
        {/* Header: platform + status badges */}
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={result.platform as AIPlatform} />
          <SentimentBadge sentiment={result.brand_sentiment as BrandSentiment} />
          <StatusChip positive={result.brand_mentioned} label="Mentioned" />
          <StatusChip positive={result.domain_cited} label="Cited" />
          <PositionBadge position={result.brand_position} />
        </div>

        {/* Response text */}
        <div className="text-muted-foreground text-sm">
          <p>
            {expanded ? result.response_text : snippet}
            {!expanded && hasMore && '...'}
          </p>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="text-primary mt-1 text-xs font-medium hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Competitor mentions */}
        {result.competitor_mentions && <CompetitorPills competitors={result.competitor_mentions} />}

        {/* Insight */}
        {result.insight && (
          <div
            className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3"
            data-testid="research-insight"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Lightbulb className="size-3.5" />
              Insight
            </div>
            <p className="text-sm whitespace-pre-line text-amber-900">{result.insight}</p>
          </div>
        )}

        {/* Save to monitoring */}
        {onSaveToMonitoring && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onSaveToMonitoring}>
              Save to monitoring
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
