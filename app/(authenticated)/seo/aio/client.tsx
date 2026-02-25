'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScoreCard } from '@/components/audit/score-cards'
import { CheckItem } from '@/components/audit/check-item'
import { AuditRunControl } from '@/components/audit/audit-run-control'
import { SampleSizeSelector } from '@/components/aio/sample-size-selector'
import { TokenUsageBadge } from '@/components/aio/token-usage-badge'
import { AIAnalysisCard } from '@/components/aio/ai-analysis-card'
import { QualityDimensionCards } from '@/components/aio/quality-dimension-cards'
import { AIOInfoDialog } from '@/components/aio/aio-info-dialog'
import { AIOAuditHistoryList } from '@/components/aio/aio-audit-history-list'
import { ScoreTrendChart, type ScoreDataPoint } from '@/components/audit/score-trend-chart'
import { useAIOAuditStream } from '@/hooks/use-aio-audit-stream'
import type { ProgrammaticCheck } from '@/hooks/use-aio-audit-stream'
import type { SiteAuditCheck } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { AIOAudit } from '@/lib/aio/types'
import { notifyAuditStarted } from '@/hooks/use-active-audit'

interface AIOAuditClientProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
  audits: AIOAudit[]
}

export function AIOAuditClient({
  organizations,
  isInternal,
  selectedOrganizationId,
  audits,
}: AIOAuditClientProps) {
  const router = useRouter()
  const [sampleSize, setSampleSize] = useState(5)
  const aioAudit = useAIOAuditStream()

  // Determine audit target from URL params (managed by header selector)
  const selectedTarget = useMemo(() => {
    if (selectedOrganizationId) {
      const org = organizations.find((o) => o.id === selectedOrganizationId)
      if (org?.website_url) {
        return {
          type: 'organization' as const,
          organizationId: org.id,
          url: org.website_url,
        }
      }
    }
    return { type: 'one-time' as const }
  }, [selectedOrganizationId, organizations])

  const handleRunAudit = async (url: string, organizationId?: string) => {
    const response = await fetch('/api/aio/audit/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: organizationId || null, url, sampleSize }),
    })

    if (!response.ok) {
      throw new Error('Failed to start audit')
    }

    const data = await response.json()
    notifyAuditStarted()
    router.push(`/seo/aio/${data.auditId}`)
  }

  const isRunning = aioAudit.status === 'running_programmatic' || aioAudit.status === 'running_ai'
  const isComplete = aioAudit.status === 'complete'
  const hasError = aioAudit.status === 'error'

  // Group checks by category
  const checksByCategory = aioAudit.programmaticChecks.reduce(
    (acc, check) => {
      const category = getCategoryFromCheck(check)
      if (!acc[category]) acc[category] = []
      acc[category].push(check)
      return acc
    },
    {} as Record<string, ProgrammaticCheck[]>
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">AIO Audit</h1>
          <AIOInfoDialog />
        </div>
        <p className="text-muted-foreground mt-1">
          Analyze customer content for Artificial Intelligence Optimization
        </p>
      </div>

      {/* Audit Configuration Card */}
      <AuditRunControl
        title="One-Time AIO Audit"
        description="Add URL to begin AIO audit"
        organization={
          selectedTarget?.type === 'organization'
            ? {
                id: selectedTarget.organizationId,
                websiteUrl: selectedTarget.url,
              }
            : null
        }
        onRunAudit={handleRunAudit}
        isRunning={isRunning}
      >
        <SampleSizeSelector
          value={sampleSize}
          onChange={setSampleSize}
          pagesFound={aioAudit.pagesFound}
          disabled={isRunning}
        />
      </AuditRunControl>

      {/* Stream Error Display */}
      {hasError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Error</p>
          <p className="mt-1 text-xs">{aioAudit.error}</p>
        </div>
      )}

      {/* Show progress/results when audit has started */}
      {(isRunning || isComplete) && (
        <>
          {/* Score Cards */}
          {(aioAudit.technicalScore !== null ||
            aioAudit.strategicScore !== null ||
            aioAudit.overallScore !== null) && (
            <div>
              <h4 className="text-muted-foreground mb-4 text-sm font-medium">AIO Scores</h4>
              <div className="flex gap-4">
                <ScoreCard
                  label="Overall AIO"
                  score={aioAudit.overallScore}
                  description="Combined score of technical foundation and strategic content quality. Represents your overall readiness for AI citation."
                />
                <ScoreCard
                  label="Technical"
                  score={aioAudit.technicalScore}
                  description="Technical infrastructure for AI crawling: robots.txt access, schema markup, page speed, and content structure."
                />
                <ScoreCard
                  label="Strategic"
                  score={aioAudit.strategicScore}
                  description="Content quality assessed by AI: data quality, expert credibility, comprehensiveness, citability, and authority."
                />
              </div>
            </div>
          )}

          {/* Technical Foundation Checks */}
          {checksByCategory['technical_foundation'] &&
            checksByCategory['technical_foundation'].length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Technical Foundation</CardTitle>
                  <CardDescription>
                    Infrastructure that enables AI crawlers to discover and parse customer content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checksByCategory['technical_foundation'].map((check, idx) => (
                    <CheckItem
                      key={idx}
                      check={
                        {
                          id: `check-${idx}`,
                          audit_id: '',
                          page_id: null,
                          check_type: 'ai_readiness',
                          check_name: check.name,
                          priority: 'recommended',
                          status: check.status,
                          display_name: check.displayName,
                          display_name_passed: check.displayName,
                          details: null,
                          learn_more_url: undefined,
                          created_at: new Date().toISOString(),
                        } as SiteAuditCheck
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            )}

          {/* Content Structure Checks */}
          {checksByCategory['content_structure'] &&
            checksByCategory['content_structure'].length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Content Structure</CardTitle>
                  <CardDescription>
                    Formats and patterns that make content easy for AI systems to extract and cite
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checksByCategory['content_structure'].map((check, idx) => (
                    <CheckItem
                      key={idx}
                      check={
                        {
                          id: `check-${idx}`,
                          audit_id: '',
                          page_id: null,
                          check_type: 'ai_readiness',
                          check_name: check.name,
                          priority: 'recommended',
                          status: check.status,
                          display_name: check.displayName,
                          display_name_passed: check.displayName,
                          details: null,
                          learn_more_url: undefined,
                          created_at: new Date().toISOString(),
                        } as SiteAuditCheck
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            )}

          {/* Content Quality Checks */}
          {checksByCategory['content_quality'] &&
            checksByCategory['content_quality'].length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Content Quality</CardTitle>
                  <CardDescription>
                    Depth, readability, and strategic quality of customer content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checksByCategory['content_quality'].map((check, idx) => (
                    <CheckItem
                      key={idx}
                      check={
                        {
                          id: `check-${idx}`,
                          audit_id: '',
                          page_id: null,
                          check_type: 'ai_readiness',
                          check_name: check.name,
                          priority: 'recommended',
                          status: check.status,
                          display_name: check.displayName,
                          display_name_passed: check.displayName,
                          details: null,
                          learn_more_url: undefined,
                          created_at: new Date().toISOString(),
                        } as SiteAuditCheck
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            )}

          {/* AI Analysis Loading State */}
          {aioAudit.status === 'running_ai' && (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-2">
                  <Loader2
                    className="text-muted-foreground h-6 w-6 animate-spin"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground text-sm">
                    Running AI quality analysis on {aioAudit.selectedPages.length}{' '}
                    {aioAudit.selectedPages.length === 1 ? 'page' : 'pages'}…
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Results */}
          {isComplete && aioAudit.aiAnalyses.length > 0 && (
            <>
              <div>
                <h4 className="text-muted-foreground mb-4 text-sm font-medium">AI Analysis</h4>
                <QualityDimensionCards
                  dataQuality={Math.round(
                    aioAudit.aiAnalyses.reduce((sum, a) => sum + a.scores.dataQuality, 0) /
                      aioAudit.aiAnalyses.length
                  )}
                  expertCredibility={Math.round(
                    aioAudit.aiAnalyses.reduce((sum, a) => sum + a.scores.expertCredibility, 0) /
                      aioAudit.aiAnalyses.length
                  )}
                  comprehensiveness={Math.round(
                    aioAudit.aiAnalyses.reduce((sum, a) => sum + a.scores.comprehensiveness, 0) /
                      aioAudit.aiAnalyses.length
                  )}
                  citability={Math.round(
                    aioAudit.aiAnalyses.reduce((sum, a) => sum + a.scores.citability, 0) /
                      aioAudit.aiAnalyses.length
                  )}
                  authority={Math.round(
                    aioAudit.aiAnalyses.reduce((sum, a) => sum + a.scores.authority, 0) /
                      aioAudit.aiAnalyses.length
                  )}
                />
              </div>

              <AIAnalysisCard analyses={aioAudit.aiAnalyses} />

              {/* Token Usage and Cost */}
              {aioAudit.tokenUsage.total > 0 && (
                <div className="bg-muted/30 flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Analysis Complete</p>
                    <p className="text-muted-foreground text-xs">
                      Analyzed {aioAudit.selectedPages.length}{' '}
                      {aioAudit.selectedPages.length === 1 ? 'page' : 'pages'} in{' '}
                      {aioAudit.executionTime !== null
                        ? `${(aioAudit.executionTime / 1000).toFixed(1)}s`
                        : 'N/A'}
                    </p>
                  </div>
                  <TokenUsageBadge
                    inputTokens={aioAudit.tokenUsage.input}
                    outputTokens={aioAudit.tokenUsage.output}
                    totalTokens={aioAudit.tokenUsage.total}
                    cost={aioAudit.cost}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Score History - Only show for organization audits with completed data */}
      {selectedOrganizationId &&
        audits.some((a) => a.status === 'completed' && a.overall_aio_score !== null) && (
          <Card>
            <CardHeader>
              <CardTitle>Score History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreTrendChart
                dataPoints={audits
                  .filter((a) => a.status === 'completed' && a.overall_aio_score !== null)
                  .map(
                    (a): ScoreDataPoint => ({
                      score: a.overall_aio_score as number,
                      completedAt: a.completed_at,
                    })
                  )}
              />
            </CardContent>
          </Card>
        )}

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedOrganizationId ? 'Audit History' : 'One-time Audit History'}
          </CardTitle>
          {!selectedOrganizationId && (
            <CardDescription>
              Audits run on URLs not associated with an organization
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <AIOAuditHistoryList audits={audits} showUrl={!selectedOrganizationId || isInternal} />
        </CardContent>
      </Card>
    </div>
  )
}

// Helper to determine category from check (maps to AIO categories)
function getCategoryFromCheck(check: ProgrammaticCheck): string {
  // Map check categories to display categories
  return check.category
}
