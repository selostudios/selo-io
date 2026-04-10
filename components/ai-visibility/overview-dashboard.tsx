'use client'

import { ScoreRing } from '@/components/reports/score-ring'
import { ScoreTrendChart, type ScoreDataPoint } from '@/components/audit/score-trend-chart'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SyncButton } from '@/components/ai-visibility/page-header'
import { PlatformBreakdown } from '@/components/ai-visibility/platform-breakdown'
import Link from 'next/link'
import { Eye, Settings } from 'lucide-react'
import { ScoreStatus } from '@/lib/enums'
import { getScoreStatus } from '@/lib/reports/types'
import type { AIVisibilityScore, AIVisibilityConfig } from '@/lib/ai-visibility/types'
import type { ScoreHistoryPoint } from '@/lib/ai-visibility/queries'
import type { TimeSeriesDataPoint } from '@/lib/metrics/types'

const SCORE_STATUS_LABELS: Record<ScoreStatus, string> = {
  [ScoreStatus.Good]: 'Good',
  [ScoreStatus.NeedsImprovement]: 'Needs Improvement',
  [ScoreStatus.Poor]: 'Poor',
}

interface OverviewDashboardProps {
  orgId: string
  latestScore: AIVisibilityScore | null
  previousScore: AIVisibilityScore | null
  scoreHistory: ScoreHistoryPoint[]
  config: AIVisibilityConfig | null
  isInternal?: boolean
}

export function OverviewDashboard({
  orgId,
  latestScore,
  previousScore,
  scoreHistory,
  config,
  isInternal = false,
}: OverviewDashboardProps) {
  const hasData = latestScore !== null

  // Map score history for ScoreTrendChart
  const trendDataPoints: ScoreDataPoint[] = scoreHistory.map((s) => ({
    score: s.score,
    completedAt: s.created_at,
  }))

  // Map score history for MetricCard sparklines
  const mentionsTimeSeries: TimeSeriesDataPoint[] = scoreHistory.map((s) => ({
    date: s.created_at.split('T')[0],
    value: s.mentions_count,
  }))

  const citationsTimeSeries: TimeSeriesDataPoint[] = scoreHistory.map((s) => ({
    date: s.created_at.split('T')[0],
    value: s.citations_count,
  }))

  const citedPagesTimeSeries: TimeSeriesDataPoint[] = scoreHistory.map((s) => ({
    date: s.created_at.split('T')[0],
    value: s.cited_pages_count,
  }))

  // Score delta
  const scoreDelta = latestScore && previousScore ? latestScore.score - previousScore.score : null

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="AI Visibility">
        <SyncButton
          orgId={orgId}
          lastSyncAt={config?.last_sync_at}
          isInternal={isInternal}
          disabled={!config}
        />
      </PageHeader>

      {!hasData ? (
        config ? (
          <EmptyState
            icon={Eye}
            title="No visibility data yet"
            description="Run your first sync to start tracking how your brand appears in AI responses."
          />
        ) : (
          <EmptyState
            icon={Settings}
            title="AI Visibility not configured"
            description={
              isInternal
                ? 'Configure AI platform API keys in App Settings to start tracking how this brand appears in AI responses.'
                : 'Contact your Selo admin to enable AI Visibility tracking for your organization.'
            }
          >
            {isInternal && (
              <Link
                href="/app-settings/integrations"
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
              >
                <Settings className="mr-2 h-4 w-4" />
                Go to Settings
              </Link>
            )}
          </EmptyState>
        )
      ) : (
        <>
          {/* Hero: Score Ring + Trend Chart */}
          <Card>
            <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2">
                <ScoreRing score={latestScore.score} size="xl" showLabel label="AI Visibility" />
                <span className="text-muted-foreground text-sm font-medium">
                  {SCORE_STATUS_LABELS[getScoreStatus(latestScore.score)]}
                  {scoreDelta !== null && scoreDelta !== 0 && (
                    <span className={`ml-2 ${scoreDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {scoreDelta > 0 ? '+' : ''}
                      {scoreDelta} from last
                    </span>
                  )}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground mb-2 text-sm font-medium">Score Trend</p>
                <ScoreTrendChart dataPoints={trendDataPoints} />
              </div>
            </CardContent>
          </Card>

          {/* Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Mentions"
              value={latestScore.mentions_count}
              change={null}
              tooltip="Number of times your brand was mentioned across AI platforms"
              timeSeries={mentionsTimeSeries}
            />
            <MetricCard
              label="Citations"
              value={latestScore.citations_count}
              change={null}
              tooltip="Number of times your domain was cited in AI responses"
              timeSeries={citationsTimeSeries}
            />
            <MetricCard
              label="Cited Pages"
              value={latestScore.cited_pages_count}
              change={null}
              tooltip="Unique pages from your domain cited by AI platforms"
              timeSeries={citedPagesTimeSeries}
            />
          </div>

          {/* Platform Breakdown */}
          <PlatformBreakdown breakdown={latestScore.platform_breakdown} />
        </>
      )}
    </div>
  )
}
