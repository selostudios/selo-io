import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ai-visibility/page-header'
import { PromptAccordion } from '@/components/ai-visibility/prompt-accordion'
import { AddPromptDialog } from '@/components/ai-visibility/add-prompt-dialog'
import { ResearchSection } from '@/components/ai-visibility/research-section'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquareText } from 'lucide-react'
import { getTopicsWithPrompts } from '@/lib/ai-visibility/queries'
import { getResearchPageData } from '../actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function PromptsPage({ params }: PageProps) {
  const { orgId } = await params
  const supabase = await createClient()

  const [topics, researchData] = await Promise.all([
    getTopicsWithPrompts(supabase, orgId),
    getResearchPageData(orgId),
  ])

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="Prompts">
        <AddPromptDialog orgId={orgId} existingTopics={topics} />
      </PageHeader>

      {topics.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No prompts configured"
          description="Add prompts to track how AI platforms respond to queries about your brand."
        />
      ) : (
        <PromptAccordion topics={topics} />
      )}

      {/* Research Section */}
      {researchData && researchData.isActive && (
        <div className="border-t pt-6">
          <ResearchSection
            orgId={orgId}
            orgName={researchData.orgName}
            websiteUrl={researchData.websiteUrl}
            competitors={researchData.competitors}
            existingTopics={topics}
            monthlySpendCents={researchData.monthlySpendCents}
            monthlyBudgetCents={researchData.monthlyBudgetCents}
          />
        </div>
      )}
    </div>
  )
}
