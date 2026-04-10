'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { ResearchResult } from '@/lib/ai-visibility/research'

const PLATFORM_LABELS: Record<string, string> = {
  [AIPlatform.ChatGPT]: 'ChatGPT',
  [AIPlatform.Claude]: 'Claude',
  [AIPlatform.Perplexity]: 'Perplexity',
}

const SENTIMENT_COLORS: Record<string, string> = {
  [BrandSentiment.Positive]: 'bg-green-100 text-green-800',
  [BrandSentiment.Neutral]: 'bg-gray-100 text-gray-800',
  [BrandSentiment.Negative]: 'bg-red-100 text-red-800',
}

interface ResearchResultCardProps {
  result: ResearchResult
  onSaveToMonitoring?: () => void
}

export function ResearchResultCard({ result, onSaveToMonitoring }: ResearchResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const truncatedResponse = result.response_text.slice(0, 200)
  const needsTruncation = result.response_text.length > 200

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3" data-testid="research-result-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500" />
          <span className="font-medium">{PLATFORM_LABELS[result.platform] ?? result.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          {result.brand_mentioned ? (
            <>
              <Badge variant="outline" className="text-xs">
                Mentioned
              </Badge>
              {result.brand_position && (
                <Badge variant="outline" className="text-xs">
                  #{result.brand_position}
                </Badge>
              )}
              <Badge
                className={`text-xs ${SENTIMENT_COLORS[result.brand_sentiment] ?? ''}`}
                variant="outline"
              >
                {result.brand_sentiment.charAt(0).toUpperCase() + result.brand_sentiment.slice(1)}
              </Badge>
              {result.domain_cited && (
                <Badge variant="outline" className="text-xs text-blue-700">
                  Cited
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not mentioned
            </Badge>
          )}
        </div>
      </div>

      {/* Response text */}
      <div className="text-sm text-muted-foreground">
        <p>{expanded ? result.response_text : truncatedResponse}</p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                Show full response <ChevronDown className="size-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Competitor mentions */}
      {result.competitor_mentions && result.competitor_mentions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.competitor_mentions
            .filter((c) => c.mentioned)
            .map((c) => (
              <Badge key={c.name} variant="secondary" className="text-xs">
                {c.name}
                {c.cited ? ' (cited)' : ''}
              </Badge>
            ))}
        </div>
      )}

      {/* Insight */}
      {result.insight && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1"
          data-testid="research-insight"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <Lightbulb className="size-3.5" />
            Insight
          </div>
          <p className="text-sm text-amber-900 whitespace-pre-line">{result.insight}</p>
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
    </div>
  )
}
