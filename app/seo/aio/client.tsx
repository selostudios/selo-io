'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScoreCard } from '@/components/audit/score-cards'
import { CheckItem } from '@/components/audit/check-item'
import { SampleSizeSelector } from '@/components/aio/sample-size-selector'
import { TokenUsageBadge } from '@/components/aio/token-usage-badge'
import { AIAnalysisCard } from '@/components/aio/ai-analysis-card'
import { QualityDimensionCards } from '@/components/aio/quality-dimension-cards'
import { AIOInfoDialog } from '@/components/aio/aio-info-dialog'
import { AIOAuditHistoryList } from '@/components/aio/aio-audit-history-list'
import { useAIOAuditStream } from '@/hooks/use-aio-audit-stream'
import type { ProgrammaticCheck } from '@/hooks/use-aio-audit-stream'
import type { SiteAuditCheck } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { AIOAudit } from '@/lib/aio/types'

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
  const [oneTimeUrl, setOneTimeUrl] = useState('')
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

  const handleStartAudit = async () => {
    let url: string
    let organizationId: string | null = null

    if (selectedTarget.type === 'organization') {
      url = selectedTarget.url
      organizationId = selectedTarget.organizationId
    } else {
      // One-time audit
      if (!oneTimeUrl.trim()) return

      url = oneTimeUrl.trim()
      // Add https:// if no protocol specified
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
    }

    try {
      const response = await fetch('/api/aio/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, url, sampleSize }),
      })

      if (!response.ok) {
        console.error('Failed to start audit')
        return
      }

      const data = await response.json()
      router.push(`/seo/aio/${data.auditId}`)
    } catch (error) {
      console.error('Failed to start audit:', error)
    }
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
      <Card>
        <CardHeader>
          {selectedTarget?.type === 'one-time' ? (
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>One-Time AIO Audit</CardTitle>
                <CardDescription>Add URL to begin AIO audit</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com"
                  className="w-64"
                  id="url"
                  value={oneTimeUrl}
                  onChange={(e) => setOneTimeUrl(e.target.value)}
                  disabled={isRunning}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && oneTimeUrl.trim() && !isRunning) {
                      handleStartAudit()
                    }
                  }}
                  autoComplete="url"
                  name="website-url"
                />
                <Button
                  onClick={handleStartAudit}
                  disabled={!oneTimeUrl.trim() || isRunning}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Running…
                    </>
                  ) : (
                    'Run Audit'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <CardTitle>Run AIO Audit</CardTitle>
              <CardDescription>
                Analyze customer website readiness for AI-powered search engines
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <SampleSizeSelector
            value={sampleSize}
            onChange={setSampleSize}
            pagesFound={aioAudit.pagesFound}
            disabled={isRunning}
          />

          {selectedTarget?.type !== 'one-time' && (
            <Button
              onClick={handleStartAudit}
              disabled={!selectedTarget || isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Running…
                </>
              ) : (
                'Run Audit'
              )}
            </Button>
          )}

          {hasError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">Error</p>
              <p className="mt-1 text-xs">{aioAudit.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
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
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Analysis Complete</p>
                    <p className="text-xs text-muted-foreground">
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

      {/* Audit History */}
      {audits.length > 0 && (
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
            <AIOAuditHistoryList
              audits={audits}
              showUrl={!selectedOrganizationId || isInternal}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper to determine category from check (maps to AIO categories)
function getCategoryFromCheck(check: ProgrammaticCheck): string {
  // Map check categories to display categories
  return check.category
}
