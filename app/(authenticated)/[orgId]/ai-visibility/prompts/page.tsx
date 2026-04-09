import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquareText } from 'lucide-react'

export default function AIVisibilityPromptsPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold" data-testid="ai-visibility-prompts-page-title">
        Prompts
      </h1>
      <EmptyState
        icon={MessageSquareText}
        title="No prompts configured"
        description="Add topics and prompts to start tracking your brand's AI visibility."
      />
    </div>
  )
}
