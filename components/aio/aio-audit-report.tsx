'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronDown, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScoreCard } from '@/components/audit/score-cards'
import { CheckItem } from '@/components/audit/check-item'
import { AIAnalysisCard } from '@/components/aio/ai-analysis-card'
import { QualityDimensionCards } from '@/components/aio/quality-dimension-cards'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { AIOAudit, AIOCheck, AIOAIAnalysis } from '@/lib/aio/types'
import type { SiteAuditCheck } from '@/lib/audit/types'
import type { AIOPageAnalysis } from '@/lib/aio/types'

interface AIOAuditReportProps {
  audit: AIOAudit
  checks: AIOCheck[]
  aiAnalyses: AIOAIAnalysis[]
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function AIOAuditReport({ audit, checks, aiAnalyses }: AIOAuditReportProps) {
  // Group checks by category
  const checksByCategory = checks.reduce(
    (acc, check) => {
      if (!acc[check.category]) acc[check.category] = []
      acc[check.category].push(check)
      return acc
    },
    {} as Record<string, AIOCheck[]>
  )

  // Convert AI analyses to the format expected by AIAnalysisCard
  const formattedAnalyses: AIOPageAnalysis[] = aiAnalyses.map((analysis) => ({
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back Button */}
      <Link
        href="/seo/aio"
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AIO Audits
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">AIO Audit:</h1>
          <a
            href={audit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xl font-bold hover:underline inline-flex items-center gap-1.5"
          >
            {getDomain(audit.url)}
            <ExternalLink className="size-5 text-muted-foreground" />
          </a>
          <Badge
            variant={
              audit.status === 'completed'
                ? 'success'
                : audit.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {audit.status}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {audit.completed_at ? formatDate(audit.completed_at, false) : 'In progress'} &middot;{' '}
          {audit.pages_analyzed} {audit.pages_analyzed === 1 ? 'page' : 'pages'} analyzed
          {audit.execution_time_ms !== null
            ? ` · ${(audit.execution_time_ms / 1000).toFixed(1)}s`
            : ''}
          {audit.total_input_tokens && audit.total_output_tokens
            ? ` · ${((audit.total_input_tokens ?? 0) + (audit.total_output_tokens ?? 0)).toLocaleString()} tokens`
            : ''}
          {audit.total_cost !== null && audit.total_cost !== undefined
            ? ` · $${audit.total_cost.toFixed(4)}`
            : ''}
        </p>
      </div>

      {/* Score Cards */}
      <div>
        <h4 className="text-muted-foreground mb-4 text-sm font-medium">AIO Scores</h4>
        <div className="flex gap-4">
          <ScoreCard
            label="Overall AIO"
            score={audit.overall_aio_score}
            description="Combined score of technical foundation and strategic content quality. Represents overall readiness for AI citation."
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
      </div>

      {/* AI Analysis Quality Dimensions */}
      {formattedAnalyses.length > 0 && (
        <div>
          <h4 className="text-muted-foreground mb-4 text-sm font-medium">AI Analysis</h4>
          <QualityDimensionCards
            dataQuality={Math.round(
              formattedAnalyses.reduce((sum, a) => sum + a.scores.dataQuality, 0) /
                formattedAnalyses.length
            )}
            expertCredibility={Math.round(
              formattedAnalyses.reduce((sum, a) => sum + a.scores.expertCredibility, 0) /
                formattedAnalyses.length
            )}
            comprehensiveness={Math.round(
              formattedAnalyses.reduce((sum, a) => sum + a.scores.comprehensiveness, 0) /
                formattedAnalyses.length
            )}
            citability={Math.round(
              formattedAnalyses.reduce((sum, a) => sum + a.scores.citability, 0) /
                formattedAnalyses.length
            )}
            authority={Math.round(
              formattedAnalyses.reduce((sum, a) => sum + a.scores.authority, 0) /
                formattedAnalyses.length
            )}
          />
        </div>
      )}

      {/* AI Recommendations & Technical Checks */}
      {formattedAnalyses.length > 0 && (
        <Card className="border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-3">
            <AIAnalysisCard analyses={formattedAnalyses} />

            {/* Technical Foundation */}
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

            {/* Content Structure */}
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
          </div>
        </Card>
      )}
    </div>
  )
}
