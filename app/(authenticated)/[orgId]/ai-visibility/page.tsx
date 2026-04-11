import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { OverviewDashboard } from '@/components/ai-visibility/overview-dashboard'
import {
  getLatestScores,
  getScoreHistory,
  getAIVisibilityConfig,
} from '@/lib/ai-visibility/queries'
import { getAvailablePlatforms } from '@/lib/ai-visibility/platforms/provider-keys'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AIVisibilityPage({ params }: PageProps) {
  const { orgId } = await params
  const supabase = await createClient()

  const [scores, history, config, user, availablePlatforms] = await Promise.all([
    getLatestScores(supabase, orgId),
    getScoreHistory(supabase, orgId),
    getAIVisibilityConfig(supabase, orgId),
    getAuthUser(),
    getAvailablePlatforms(),
  ])

  const userRecord = user ? await getUserRecord(user.id) : null
  const isInternal = userRecord != null && isInternalUser(userRecord)

  return (
    <OverviewDashboard
      orgId={orgId}
      latestScore={scores.latest}
      previousScore={scores.previous}
      scoreHistory={history}
      config={config}
      isInternal={isInternal}
      availablePlatforms={availablePlatforms}
    />
  )
}
