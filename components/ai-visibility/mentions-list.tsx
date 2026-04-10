'use client'

import { useState, useTransition } from 'react'
import { MentionCard } from '@/components/ai-visibility/mention-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { AtSign, SearchX } from 'lucide-react'
import { loadMoreMentions } from '@/app/(authenticated)/[orgId]/ai-visibility/mentions/actions'
import type { MentionResult } from '@/lib/ai-visibility/queries'

interface MentionsListProps {
  orgId: string
  initialMentions: MentionResult[]
  initialHasMore: boolean
  hasFilters: boolean
  filters: { platform?: string; sentiment?: string; days?: number }
}

export function MentionsList({
  orgId,
  initialMentions,
  initialHasMore,
  hasFilters,
  filters,
}: MentionsListProps) {
  const [mentions, setMentions] = useState(initialMentions)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isPending, startTransition] = useTransition()

  const handleLoadMore = () => {
    const lastMention = mentions[mentions.length - 1]
    if (!lastMention) return

    startTransition(async () => {
      const page = await loadMoreMentions(orgId, filters, lastMention.queried_at)
      setMentions((prev) => [...prev, ...page.mentions])
      setHasMore(page.hasMore)
    })
  }

  if (mentions.length === 0) {
    return hasFilters ? (
      <EmptyState
        icon={SearchX}
        title="No mentions match your filters"
        description="Try adjusting the platform, sentiment, or date range filters."
      />
    ) : (
      <EmptyState
        icon={AtSign}
        title="No mentions yet"
        description="Run a sync to start tracking how AI platforms mention your brand."
      />
    )
  }

  return (
    <div className="space-y-3">
      {mentions.map((mention) => (
        <MentionCard key={mention.id} mention={mention} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
