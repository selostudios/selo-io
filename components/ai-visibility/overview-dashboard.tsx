'use client'

import { ScoreRing } from '@/components/reports/score-ring'
import { ScoreTrendChart, type ScoreDataPoint } from '@/components/audit/score-trend-chart'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SyncButton } from '@/components/ai-visibility/page-header'
import { PlatformBreakdown } from '@/components/ai-visibility/platform-breakdown'
import Link from 'next/link'
import { Eye, Settings, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIPlatform, ScoreStatus } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import { ALL_PLATFORMS } from '@/lib/ai-visibility/types'
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
  availablePlatforms?: AIPlatform[]
}

export function OverviewDashboard({
  orgId,
  latestScore,
  previousScore,
  scoreHistory,
  config,
  isInternal = false,
  availablePlatforms = [],
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
          disabled={!config || availablePlatforms.length === 0}
        />
      </PageHeader>

      {!hasData ? (
        <AIVisibilityEmptyState
          orgId={orgId}
          config={config}
          isInternal={isInternal}
          availablePlatforms={availablePlatforms}
        />
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
          <PlatformBreakdown
            breakdown={latestScore.platform_breakdown}
            configuredPlatforms={config?.platforms}
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State Sub-Component
// ---------------------------------------------------------------------------

interface AIVisibilityEmptyStateProps {
  orgId: string
  config: AIVisibilityConfig | null
  isInternal: boolean
  availablePlatforms: AIPlatform[]
}

export function AIVisibilityEmptyState({
  orgId,
  config,
  isInternal,
  availablePlatforms,
}: AIVisibilityEmptyStateProps) {
  const missingPlatforms = ALL_PLATFORMS.filter((p) => !availablePlatforms.includes(p))
  const hasSomePlatforms = availablePlatforms.length > 0
  const hasAllPlatforms = missingPlatforms.length === 0

  // Case 1: Config exists, at least one platform available → ready to sync
  if (config && hasSomePlatforms) {
    const enabledNames = availablePlatforms.map((p) => PLATFORM_DISPLAY_NAMES[p]).join(', ')
    return (
      <EmptyState
        icon={Eye}
        title="No visibility data yet"
        description={`AI Visibility is enabled for ${enabledNames}. Run your first sync to start tracking.`}
      >
        <div className="mt-4 flex items-center gap-2">
          <SyncButton orgId={orgId} lastSyncAt={config.last_sync_at} isInternal={isInternal} />
          {!hasAllPlatforms && isInternal && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/app-settings/integrations">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add AI Models
              </Link>
            </Button>
          )}
        </div>
      </EmptyState>
    )
  }

  // Case 2: Config exists but no platforms have credentials
  if (config) {
    return (
      <EmptyState
        icon={Settings}
        title="No AI platform API keys configured"
        description={
          isInternal
            ? 'Add at least one AI platform API key to start tracking visibility.'
            : 'Contact your Selo admin to configure AI platform API keys.'
        }
      >
        {isInternal && (
          <Button className="mt-4" size="sm" asChild>
            <Link href="/app-settings/integrations">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add AI Models
            </Link>
          </Button>
        )}
      </EmptyState>
    )
  }

  // Case 3: No config, but some platforms available → encourage setup
  if (hasSomePlatforms) {
    const enabledNames = availablePlatforms.map((p) => PLATFORM_DISPLAY_NAMES[p]).join(', ')
    return (
      <EmptyState
        icon={Eye}
        title="AI Visibility ready"
        description={`${enabledNames} ${availablePlatforms.length === 1 ? 'is' : 'are'} available. Enable AI Visibility in organization settings to start tracking.`}
      >
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href={`/${orgId}/settings/organization`}>
              <Settings className="mr-1 h-3.5 w-3.5" />
              Enable AI Visibility
            </Link>
          </Button>
          {!hasAllPlatforms && isInternal && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/app-settings/integrations">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add AI Models
              </Link>
            </Button>
          )}
        </div>
      </EmptyState>
    )
  }

  // Case 4: No config, no platforms → fully unconfigured
  return (
    <EmptyState
      icon={Settings}
      title="AI Visibility not configured"
      description={
        isInternal
          ? 'Configure AI platform API keys to start tracking how this brand appears in AI responses.'
          : 'Contact your Selo admin to enable AI Visibility tracking for your organization.'
      }
    >
      {isInternal && (
        <Button className="mt-4" size="sm" asChild>
          <Link href="/app-settings/integrations">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add AI Models
          </Link>
        </Button>
      )}
    </EmptyState>
  )
}
