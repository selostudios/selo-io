'use client'

import { Sparkles, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScoreCard } from '@/components/audit/score-cards'
import { CheckItem } from '@/components/audit/check-item'
import { AIAnalysisCard } from '@/components/geo/ai-analysis-card'
import { TokenUsageBadge } from '@/components/geo/token-usage-badge'
import { cn } from '@/lib/utils'
import type { GEOAudit, GEOCheck, GEOAIAnalysis } from '@/lib/geo/types'
import type { SiteAuditCheck } from '@/lib/audit/types'
import type { GEOPageAnalysis } from '@/lib/geo/types'

interface GEOAuditReportProps {
  audit: GEOAudit
  checks: GEOCheck[]
  aiAnalyses: GEOAIAnalysis[]
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function calculateStrategicScore(analyses: GEOAIAnalysis[]): number {
  if (analyses.length === 0) return 0

  const weights = {
    dataQuality: 0.25,
    expertCredibility: 0.20,
    comprehensiveness: 0.20,
    citability: 0.25,
    authority: 0.10,
  }

  const totalScore = analyses.reduce((sum, analysis) => {
    const pageScore =
      (analysis.score_data_quality ?? 0) * weights.dataQuality +
      (analysis.score_expert_credibility ?? 0) * weights.expertCredibility +
      (analysis.score_comprehensiveness ?? 0) * weights.comprehensiveness +
      (analysis.score_citability ?? 0) * weights.citability +
      (analysis.score_authority ?? 0) * weights.authority

    return sum + pageScore
  }, 0)

  return Math.round(totalScore / analyses.length)
}

export function GEOAuditReport({ audit, checks, aiAnalyses }: GEOAuditReportProps) {
  // Group checks by category
  const checksByCategory = checks.reduce(
    (acc, check) => {
      if (!acc[check.category]) acc[check.category] = []
      acc[check.category].push(check)
      return acc
    },
    {} as Record<string, GEOCheck[]>
  )

  // Convert AI analyses to the format expected by AIAnalysisCard
  const formattedAnalyses: GEOPageAnalysis[] = aiAnalyses.map((analysis) => ({
    url: analysis.page_url,
    scores: {
      dataQuality: analysis.score_data_quality ?? 0,
      expertCredibility: analysis.score_expert_credibility ?? 0,
      comprehensiveness: analysis.score_comprehensiveness ?? 0,
      citability: analysis.score_citability ?? 0,
      authority: analysis.score_authority ?? 0,
      overall: analysis.score_overall ?? 0,
    },
    findings: analysis.findings ?? {},
    recommendations: analysis.recommendations ?? [],
  }))

  const strategicScore = calculateStrategicScore(aiAnalyses)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Sparkles className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold">GEO Audit Results</h1>
          <p className="text-muted-foreground">{getDomain(audit.url)}</p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="flex gap-4">
        <ScoreCard
          label="Overall GEO"
          score={audit.overall_geo_score}
          description="Combined score of technical foundation and strategic content quality. Represents your overall readiness for AI citation."
        />
        <ScoreCard
          label="Technical"
          score={audit.technical_score}
          description="Technical infrastructure for AI crawling: robots.txt access, schema markup, page speed, and content structure."
        />
        <ScoreCard
          label="Strategic"
          score={audit.strategic_score}
          description="Content quality assessed by AI: data quality, expert credibility, comprehensiveness, citability, and authority."
        />
      </div>

      {/* AI Analysis at Top */}
      {formattedAnalyses.length > 0 && strategicScore !== null && (
        <AIAnalysisCard analyses={formattedAnalyses} strategicScore={strategicScore} />
      )}

      {/* Token Usage and Cost */}
      {audit.total_input_tokens && audit.total_output_tokens && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Audit Complete</p>
                <p className="text-xs text-muted-foreground">
                  Analyzed {audit.pages_analyzed} {audit.pages_analyzed === 1 ? 'page' : 'pages'} in{' '}
                  {audit.execution_time_ms !== null
                    ? `${(audit.execution_time_ms / 1000).toFixed(1)}s`
                    : 'N/A'}
                </p>
              </div>
              <TokenUsageBadge
                inputTokens={audit.total_input_tokens ?? 0}
                outputTokens={audit.total_output_tokens ?? 0}
                totalTokens={(audit.total_input_tokens ?? 0) + (audit.total_output_tokens ?? 0)}
                cost={audit.total_cost ?? undefined}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Programmatic Checks in Collapsible Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Analysis</CardTitle>
          <CardDescription>
            Programmatic checks for technical foundation, content structure, and content quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checksByCategory['technical_foundation'] && (
            <Collapsible defaultOpen className="group/category">
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/30 transition-colors">
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                    'group-data-[state=closed]/category:-rotate-90'
                  )}
                />
                <span className="font-semibold">Technical Foundation</span>
                <span className="text-sm text-muted-foreground ml-auto">
                  ({checksByCategory['technical_foundation'].length} checks)
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-6 space-y-1">
                {checksByCategory['technical_foundation'].map((check) => (
                  <CheckItem
                    key={check.id}
                    check={
                      {
                        id: check.id,
                        audit_id: check.audit_id,
                        page_id: null,
                        check_type: 'ai_readiness',
                        check_name: check.check_name,
                        priority: check.priority,
                        status: check.status,
                        display_name: check.display_name ?? check.check_name,
                        display_name_passed: check.display_name_passed ?? check.display_name ?? check.check_name,
                        details: check.details,
                        learn_more_url: check.learn_more_url ?? undefined,
                        created_at: check.created_at,
                      } as SiteAuditCheck
                    }
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {checksByCategory['content_structure'] && (
            <Collapsible defaultOpen={false} className="group/category">
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/30 transition-colors">
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                    'group-data-[state=closed]/category:-rotate-90'
                  )}
                />
                <span className="font-semibold">Content Structure</span>
                <span className="text-sm text-muted-foreground ml-auto">
                  ({checksByCategory['content_structure'].length} checks)
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-6 space-y-1">
                {checksByCategory['content_structure'].map((check) => (
                  <CheckItem
                    key={check.id}
                    check={
                      {
                        id: check.id,
                        audit_id: check.audit_id,
                        page_id: null,
                        check_type: 'ai_readiness',
                        check_name: check.check_name,
                        priority: check.priority,
                        status: check.status,
                        display_name: check.display_name ?? check.check_name,
                        display_name_passed: check.display_name_passed ?? check.display_name ?? check.check_name,
                        details: check.details,
                        learn_more_url: check.learn_more_url ?? undefined,
                        created_at: check.created_at,
                      } as SiteAuditCheck
                    }
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {checksByCategory['content_quality'] && (
            <Collapsible defaultOpen={false} className="group/category">
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/30 transition-colors">
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                    'group-data-[state=closed]/category:-rotate-90'
                  )}
                />
                <span className="font-semibold">Content Quality</span>
                <span className="text-sm text-muted-foreground ml-auto">
                  ({checksByCategory['content_quality'].length} checks)
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-6 space-y-1">
                {checksByCategory['content_quality'].map((check) => (
                  <CheckItem
                    key={check.id}
                    check={
                      {
                        id: check.id,
                        audit_id: check.audit_id,
                        page_id: null,
                        check_type: 'ai_readiness',
                        check_name: check.check_name,
                        priority: check.priority,
                        status: check.status,
                        display_name: check.display_name ?? check.check_name,
                        display_name_passed: check.display_name_passed ?? check.display_name ?? check.check_name,
                        details: check.details,
                        learn_more_url: check.learn_more_url ?? undefined,
                        created_at: check.created_at,
                      } as SiteAuditCheck
                    }
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
