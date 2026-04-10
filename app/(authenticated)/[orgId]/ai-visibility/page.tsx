import { createClient } from '@/lib/supabase/server'
import { OverviewDashboard } from '@/components/ai-visibility/overview-dashboard'
import {
  getLatestScores,
  getScoreHistory,
  getAIVisibilityConfig,
} from '@/lib/ai-visibility/queries'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AIVisibilityPage({ params }: PageProps) {
  const { orgId } = await params
  const supabase = await createClient()

  const [scores, history, config] = await Promise.all([
    getLatestScores(supabase, orgId),
    getScoreHistory(supabase, orgId),
    getAIVisibilityConfig(supabase, orgId),
  ])

  return (
    <OverviewDashboard
      orgId={orgId}
      latestScore={scores.latest}
      previousScore={scores.previous}
      scoreHistory={history}
      config={config}
    />
  )
}
