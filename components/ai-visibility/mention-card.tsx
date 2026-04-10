'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'
import { AIPlatform } from '@/lib/enums'
import type { MentionResult } from '@/lib/ai-visibility/queries'

interface MentionCardProps {
  mention: MentionResult
}

export function MentionCard({ mention }: MentionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const snippet = mention.response_text.slice(0, 200)
  const hasMore = mention.response_text.length > 200

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Header: prompt text */}
        <p className="truncate text-sm font-medium">{mention.prompt_text}</p>

        {/* Meta: platform + sentiment + date */}
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={mention.platform as AIPlatform} />
          <SentimentBadge sentiment={mention.brand_sentiment} />
          <span className="text-muted-foreground text-xs">
            {new Date(mention.queried_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Response snippet */}
        <div className="text-muted-foreground text-sm">
          <p>
            {expanded ? mention.response_text : snippet}
            {!expanded && hasMore && '...'}
          </p>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary mt-1 text-xs font-medium hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Footer: status chips + competitor pills */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip positive={mention.brand_mentioned} label="Mentioned" />
          <StatusChip positive={mention.domain_cited} label="Cited" />
          <PositionBadge position={mention.brand_position} />
        </div>
        {mention.competitor_mentions && (
          <CompetitorPills competitors={mention.competitor_mentions} />
        )}
      </CardContent>
    </Card>
  )
}
