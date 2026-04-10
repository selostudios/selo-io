'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'
import { BrandSentiment, AIPlatform } from '@/lib/enums'
import type { TopicWithPrompts, PromptWithResults } from '@/lib/ai-visibility/queries'
import type { AIVisibilityResult } from '@/lib/ai-visibility/types'

interface PromptAccordionProps {
  topics: TopicWithPrompts[]
}

export function PromptAccordion({ topics }: PromptAccordionProps) {
  return (
    <div className="space-y-3">
      {topics.map((topic, index) => (
        <TopicSection key={topic.id} topic={topic} defaultOpen={index === 0} />
      ))}
    </div>
  )
}

function TopicSection({ topic, defaultOpen }: { topic: TopicWithPrompts; defaultOpen: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card>
        <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between p-4 text-left">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]_&]:-rotate-90" />
            <span className="font-medium">{topic.name}</span>
            <Badge variant="secondary" className="text-xs">
              {topic.prompts.length} prompt{topic.prompts.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-3 pb-3">
            {topic.prompts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No prompts in this topic yet.</p>
            ) : (
              <div className="space-y-1">
                {topic.prompts.map((prompt) => (
                  <PromptRow key={prompt.id} prompt={prompt} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function PromptRow({ prompt }: { prompt: PromptWithResults }) {
  const [expanded, setExpanded] = useState(false)
  const mentionedCount = prompt.results.filter((r) => r.brand_mentioned).length
  const totalPlatforms = prompt.results.length
  const sentiments = prompt.results.filter((r) => r.brand_mentioned).map((r) => r.brand_sentiment)
  const dominantSentiment = sentiments.length > 0 ? getDominantSentiment(sentiments) : null

  return (
    <div className="rounded-md border">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="hover:bg-muted/50 flex w-full items-center justify-between gap-4 p-3 text-left text-sm"
      >
        <span className="min-w-0 flex-1 truncate">{prompt.prompt_text}</span>
        <div className="flex shrink-0 items-center gap-3">
          {totalPlatforms > 0 && (
            <>
              <span className="text-muted-foreground text-xs">
                {mentionedCount}/{totalPlatforms} mentioned
              </span>
              {dominantSentiment && <SentimentBadge sentiment={dominantSentiment} />}
            </>
          )}
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>
      {expanded && prompt.results.length > 0 && (
        <div className="bg-muted/20 border-t p-3">
          <div className="space-y-3">
            {prompt.results.map((result) => (
              <ResultDetail key={result.id} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultDetail({ result }: { result: AIVisibilityResult }) {
  return (
    <div className="bg-background space-y-2 rounded-md p-3">
      <div className="flex items-center gap-2">
        <PlatformBadge platform={result.platform as AIPlatform} />
        {result.brand_mentioned && <SentimentBadge sentiment={result.brand_sentiment} />}
        <PositionBadge position={result.brand_position} />
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusChip positive={result.brand_mentioned} label="Mentioned" />
        <StatusChip positive={result.domain_cited} label="Cited" />
      </div>
      {result.competitor_mentions && <CompetitorPills competitors={result.competitor_mentions} />}
      <p className="text-muted-foreground line-clamp-3 text-xs">{result.response_text}</p>
    </div>
  )
}

function getDominantSentiment(sentiments: BrandSentiment[]): BrandSentiment {
  const counts = sentiments.reduce(
    (acc, s) => {
      acc[s] = (acc[s] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as BrandSentiment
}
