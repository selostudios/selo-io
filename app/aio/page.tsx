'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScoreCard } from '@/components/audit/score-cards'
import { CheckItem } from '@/components/audit/check-item'
import { SampleSizeSelector } from '@/components/aio/sample-size-selector'
import { TokenUsageBadge } from '@/components/aio/token-usage-badge'
import { AIAnalysisCard } from '@/components/aio/ai-analysis-card'
import { useAIOAuditStream } from '@/hooks/use-aio-audit-stream'
import type { ProgrammaticCheck } from '@/hooks/use-aio-audit-stream'
import type { SiteAuditCheck } from '@/lib/audit/types'

export default function AIOAuditPage() {
  const [url, setUrl] = useState('')
  const [sampleSize, setSampleSize] = useState(5)
  const aioAudit = useAIOAuditStream()

  const handleStartAudit = async () => {
    if (!url.trim()) return

    let normalizedUrl = url.trim()
    // Add https:// if no protocol specified
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    await aioAudit.startAudit(null, normalizedUrl, sampleSize)
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
      <div className="flex items-start gap-3">
        <Sparkles className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold">AIO Audit</h1>
          <p className="text-muted-foreground">
            Analyze your content for Artificial Intelligence Optimization - how well AI systems like
            ChatGPT, Claude, and Perplexity can discover and cite your content
          </p>
        </div>
      </div>

      {/* Audit Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Run AIO Audit</CardTitle>
          <CardDescription>
            Analyze your website&apos;s readiness for AI-powered search engines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isRunning}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !isRunning) {
                    handleStartAudit()
                  }
                }}
                className="flex-1"
                autoComplete="url"
                name="website-url"
              />
              <Button onClick={handleStartAudit} disabled={!url.trim() || isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Running…
                  </>
                ) : (
                  'Start Audit'
                )}
              </Button>
            </div>
          </div>

          <SampleSizeSelector
            value={sampleSize}
            onChange={setSampleSize}
            pagesFound={aioAudit.pagesFound}
            disabled={isRunning}
          />

          {hasError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">Error</p>
              <p className="mt-1 text-xs">{aioAudit.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show progress/results only if audit has started */}
      {(isRunning || isComplete) && (
        <>
          {/* Score Cards */}
          {(aioAudit.technicalScore !== null ||
            aioAudit.strategicScore !== null ||
            aioAudit.overallScore !== null) && (
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
            aioAudit.aiAnalyses.length > 0 ||
            aioAudit.status === 'running_ai') && (
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

                {/* AI Analysis Loading State */}
                {aioAudit.status === 'running_ai' && aioAudit.aiAnalyses.length === 0 && (
                  <div className="flex items-center justify-center rounded-md border bg-muted/30 py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        Running AI quality analysis on {aioAudit.selectedPages.length}{' '}
                        {aioAudit.selectedPages.length === 1 ? 'page' : 'pages'}…
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Analysis Results */}
                {aioAudit.aiAnalyses.length > 0 && aioAudit.strategicScore !== null && (
                  <AIAnalysisCard analyses={aioAudit.aiAnalyses} />
                )}

                {/* Token Usage and Cost */}
                {isComplete && aioAudit.tokenUsage.total > 0 && (
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
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State - Show before audit starts */}
      {aioAudit.status === 'idle' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Sparkles className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>Ready to Analyze</CardTitle>
            <CardDescription>
              Enter your website URL above and configure the sample size to start your AIO audit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">What is GEO?</p>
              <p>
                Artificial Intelligence Optimization (GEO) is the practice of optimizing content for AI
                systems like ChatGPT, Claude, Perplexity, and Gemini. These AI engines need
                different signals than traditional search engines.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">What we check:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong>Technical Foundation:</strong> AI crawler access, schema markup, page
                  speed
                </li>
                <li>
                  <strong>Content Structure:</strong> FAQ sections, comparison tables, step-by-step
                  guides
                </li>
                <li>
                  <strong>Content Quality:</strong> Data sourcing, expert credibility,
                  comprehensiveness
                </li>
              </ul>
            </div>
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
