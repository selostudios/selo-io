import { EmptyState } from '@/components/ui/empty-state'
import { Eye } from 'lucide-react'

export default function AIVisibilityOverviewPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold" data-testid="ai-visibility-page-title">
        AI Visibility
      </h1>
      <EmptyState
        icon={Eye}
        title="Coming soon"
        description="Track how your brand appears in AI-generated responses across ChatGPT, Claude, and Perplexity."
      />
    </div>
  )
}
