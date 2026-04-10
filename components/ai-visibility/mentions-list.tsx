import { MentionCard } from '@/components/ai-visibility/mention-card'
import { EmptyState } from '@/components/ui/empty-state'
import { AtSign, SearchX } from 'lucide-react'
import type { MentionResult } from '@/lib/ai-visibility/queries'

interface MentionsListProps {
  mentions: MentionResult[]
  hasFilters: boolean
}

export function MentionsList({ mentions, hasFilters }: MentionsListProps) {
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
    </div>
  )
}
