'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScoreCard } from '@/components/audit/score-cards'
import { CheckItem } from '@/components/audit/check-item'
import { SampleSizeSelector } from '@/components/geo/sample-size-selector'
import { TokenUsageBadge } from '@/components/geo/token-usage-badge'
import { AIAnalysisCard } from '@/components/geo/ai-analysis-card'
import { GEOInfoDialog } from '@/components/geo/geo-info-dialog'
import { GEOAuditHistoryList } from '@/components/geo/geo-audit-history-list'
import { AuditTargetSelector, type AuditTarget } from '@/components/seo/audit-target-selector'
import { useGEOAuditStream } from '@/hooks/use-geo-audit-stream'
import type { ProgrammaticCheck } from '@/hooks/use-geo-audit-stream'
import type { SiteAuditCheck } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { GEOAudit } from '@/lib/geo/types'

interface GEOAuditClientProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
  audits: GEOAudit[]
}

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_VIEW_KEY = 'selo-last-view-type'

function getInitialTarget(
  selectedOrganizationId: string | null,
  organizations: OrganizationForSelector[]
): AuditTarget {
  // If an organization is selected via URL param
  if (selectedOrganizationId) {
    const org = organizations.find((o) => o.id === selectedOrganizationId)
    if (org?.website_url) {
      return {
        type: 'organization',
        organizationId: org.id,
        url: org.website_url,
      }
    }
  }

  // Check localStorage for last view type
  if (typeof window !== 'undefined') {
    const lastViewType = localStorage.getItem(LAST_VIEW_KEY)
    if (lastViewType === 'one-time') {
      return { type: 'one-time' }
    }
  }

  // Check localStorage for last selected org
  if (typeof window !== 'undefined') {
    const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
    if (lastOrgId) {
      const org = organizations.find((o) => o.id === lastOrgId)
      if (org?.website_url) {
        return {
          type: 'organization',
          organizationId: org.id,
          url: org.website_url,
        }
      }
    }
  }

  // Fall back to first organization with a website URL
  const firstOrgWithUrl = organizations.find((o) => o.website_url)
  if (firstOrgWithUrl) {
    return {
      type: 'organization',
      organizationId: firstOrgWithUrl.id,
      url: firstOrgWithUrl.website_url!,
    }
  }

  return null
}

export function GEOAuditClient({
  organizations,
  isInternal,
  selectedOrganizationId,
  audits,
}: GEOAuditClientProps) {
  const router = useRouter()
  const [sampleSize, setSampleSize] = useState(5)
  const [oneTimeUrl, setOneTimeUrl] = useState('')
  const geoAudit = useGEOAuditStream()

  // Initialize selectedTarget based on URL param, localStorage, or first org
  const [selectedTarget, setSelectedTarget] = useState<AuditTarget>(() =>
    getInitialTarget(selectedOrganizationId, organizations)
  )

  const handleTargetChange = (target: AuditTarget) => {
    setSelectedTarget(target)

    // Update URL and localStorage when target changes
    if (target?.type === 'organization') {
      localStorage.setItem(LAST_ORG_KEY, target.organizationId)
      localStorage.setItem(LAST_VIEW_KEY, 'organization')
      router.push(`/seo/geo?org=${target.organizationId}`)
    } else if (target?.type === 'one-time') {
      localStorage.removeItem(LAST_ORG_KEY)
      localStorage.setItem(LAST_VIEW_KEY, 'one-time')
      router.push('/seo/geo')
    }
  }

  const handleStartAudit = async () => {
    if (!selectedTarget) return

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
      const response = await fetch('/api/geo/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, url, sampleSize }),
      })

      if (!response.ok) {
        console.error('Failed to start audit')
        return
      }

      const data = await response.json()
      router.push(`/seo/geo/${data.auditId}`)
    } catch (error) {
      console.error('Failed to start audit:', error)
    }
  }

  const isRunning = geoAudit.status === 'running_programmatic' || geoAudit.status === 'running_ai'
  const isComplete = geoAudit.status === 'complete'
  const hasError = geoAudit.status === 'error'

  // Group checks by category
  const checksByCategory = geoAudit.programmaticChecks.reduce(
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
      <div className="flex items-start gap-3">
        <Sparkles className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">GEO Audit</h1>
            <GEOInfoDialog />
          </div>
          <p className="text-muted-foreground">
            Analyze your content for Generative Engine Optimization - how well AI systems like
            ChatGPT, Claude, and Perplexity can discover and cite your content
          </p>
        </div>
      </div>

      {/* Audit Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Run GEO Audit</CardTitle>
          <CardDescription>
            Analyze your website&apos;s readiness for AI-powered search engines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Organization/URL Selector */}
          <div className="space-y-2">
            <Label>Audit Target</Label>
            <AuditTargetSelector
              organizations={organizations}
              selectedTarget={selectedTarget}
              onTargetChange={handleTargetChange}
              isInternal={isInternal}
            />
          </div>

          {/* One-time URL input (only shown for one-time audits) */}
          {selectedTarget?.type === 'one-time' && (
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
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
            </div>
          )}

          <SampleSizeSelector
            value={sampleSize}
            onChange={setSampleSize}
            pagesFound={geoAudit.pagesFound}
            disabled={isRunning}
          />

          <Button
            onClick={handleStartAudit}
            disabled={!selectedTarget || (selectedTarget.type === 'one-time' && !oneTimeUrl.trim()) || isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Running…
              </>
            ) : (
              'Start Audit'
            )}
          </Button>

          {hasError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">Error</p>
              <p className="mt-1 text-xs">{geoAudit.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show progress/results when audit has started */}
      {(isRunning || isComplete) && (
        <>
          {/* Score Cards */}
          {(geoAudit.technicalScore !== null ||
            geoAudit.strategicScore !== null ||
            geoAudit.overallScore !== null) && (
            <div className="flex gap-4">
              <ScoreCard
                label="Overall GEO"
                score={geoAudit.overallScore}
                description="Combined score of technical foundation and strategic content quality. Represents your overall readiness for AI citation."
              />
              <ScoreCard
                label="Technical"
                score={geoAudit.technicalScore}
                description="Technical infrastructure for AI crawling: robots.txt access, schema markup, page speed, and content structure."
              />
              <ScoreCard
                label="Strategic"
                score={geoAudit.strategicScore}
                description="Content quality assessed by AI: data quality, expert credibility, comprehensiveness, citability, and authority."
              />
            </div>
          )}

          {/* Technical Foundation Checks */}
          {checksByCategory['technical_foundation'] &&
            checksByCategory['technical_foundation'].length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Technical Foundation</CardTitle>
                  <CardDescription>
                    Infrastructure that enables AI crawlers to discover and parse your content
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

          {/* Content Quality Checks + AI Analysis */}
          {(checksByCategory['content_quality']?.length > 0 ||
            geoAudit.aiAnalyses.length > 0 ||
            geoAudit.status === 'running_ai') && (
            <Card>
              <CardHeader>
                <CardTitle>Content Quality</CardTitle>
                <CardDescription>
                  Depth, readability, and strategic quality of your content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Programmatic Content Quality Checks */}
                {checksByCategory['content_quality'] &&
                  checksByCategory['content_quality'].length > 0 && (
                    <div className="space-y-2">
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
                    </div>
                  )}

                {/* AI Analysis Loading State - Show during running_ai */}
                {geoAudit.status === 'running_ai' && (
                  <div className="flex items-center justify-center rounded-md border bg-muted/30 py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        Running AI quality analysis on {geoAudit.selectedPages.length}{' '}
                        {geoAudit.selectedPages.length === 1 ? 'page' : 'pages'}…
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Analysis Results - Only show when complete */}
                {isComplete && geoAudit.aiAnalyses.length > 0 && geoAudit.strategicScore !== null && (
                  <>
                    <AIAnalysisCard
                      analyses={geoAudit.aiAnalyses}
                      strategicScore={geoAudit.strategicScore}
                    />

                    {/* Token Usage and Cost */}
                    {geoAudit.tokenUsage.total > 0 && (
                      <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Analysis Complete</p>
                          <p className="text-xs text-muted-foreground">
                            Analyzed {geoAudit.selectedPages.length}{' '}
                            {geoAudit.selectedPages.length === 1 ? 'page' : 'pages'} in{' '}
                            {geoAudit.executionTime !== null
                              ? `${(geoAudit.executionTime / 1000).toFixed(1)}s`
                              : 'N/A'}
                          </p>
                        </div>
                        <TokenUsageBadge
                          inputTokens={geoAudit.tokenUsage.input}
                          outputTokens={geoAudit.tokenUsage.output}
                          totalTokens={geoAudit.tokenUsage.total}
                          cost={geoAudit.cost}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
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
            <GEOAuditHistoryList
              audits={audits}
              showUrl={!selectedOrganizationId || isInternal}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper to determine category from check (maps to GEO categories)
function getCategoryFromCheck(check: ProgrammaticCheck): string {
  // Map check categories to display categories
  return check.category
}
