import { EmptyState } from '@/components/ui/empty-state'
import { AtSign } from 'lucide-react'

export default function AIVisibilityMentionsPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold" data-testid="ai-visibility-mentions-page-title">
        Brand Mentions
      </h1>
      <EmptyState
        icon={AtSign}
        title="No mentions yet"
        description="Brand mentions will appear here after your first AI visibility sync."
      />
    </div>
  )
}
