import { createServiceClient } from '@/lib/supabase/server'
import { selectTopPages } from '../../importance'
import { runAIAnalysis, calculateStrategicScore } from '../../ai-auditor'
import type { PageContent } from '../../ai-auditor'
import { fetchPage } from '@/lib/audit/fetcher'
import type { AuditPage, AuditAIAnalysis, PostCrawlContext, PostCrawlResult } from '../../types'
import type { SiteAuditPage } from '@/lib/audit/types'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'

/**
 * Convert unified AuditPage to SiteAuditPage for selectTopPages compatibility.
 */
function toSiteAuditPage(page: AuditPage): SiteAuditPage {
  return {
    id: page.id,
    audit_id: page.audit_id,
    url: page.url,
    title: page.title,
    meta_description: page.meta_description,
    status_code: page.status_code,
    last_modified: page.last_modified,
    crawled_at: page.created_at,
    is_resource: page.is_resource,
    resource_type: page.resource_type,
  }
}

/**
 * Run Claude AI analysis on top pages and store results in audit_ai_analyses.
 * Returns the strategic score for blending into the AI readiness score.
 *
 * Skips entirely if ai_analysis_enabled is false on the audit.
 */
export async function runAIPhase(context: PostCrawlContext): Promise<PostCrawlResult> {
  const { auditId, url, allPages, sampleSize, organizationId } = context

  const supabase = createServiceClient()

  // Check if AI analysis is enabled for this audit
  const { data: audit } = await supabase
    .from('audits')
    .select('ai_analysis_enabled')
    .eq('id', auditId)
    .single()

  if (!audit?.ai_analysis_enabled) {
    console.error('[AI Phase] Skipping — AI analysis disabled for this audit')
    return {
      strategicScore: null,
      pagesAnalyzed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    }
  }

  // Filter to HTML pages only
  const htmlPages = allPages.filter(
    (p) => !p.is_resource && (!p.status_code || p.status_code < 400)
  )

  if (htmlPages.length === 0) {
    return {
      strategicScore: null,
      pagesAnalyzed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    }
  }

  // Select top pages by importance
  const siteAuditPages = htmlPages.map(toSiteAuditPage)
  const topPages = selectTopPages(siteAuditPages, url, sampleSize)

  // Re-fetch HTML for selected pages (HTML is not stored in DB)
  const pageContents: PageContent[] = []
  for (const pageImportance of topPages) {
    try {
      const { html, error } = await fetchPage(pageImportance.url)
      if (html && !error) {
        pageContents.push({ url: pageImportance.url, html })
      }
    } catch (error) {
      console.error(`[AI Phase] Failed to fetch ${pageImportance.url}:`, error)
    }
  }

  if (pageContents.length === 0) {
    console.error('[AI Phase] No pages could be fetched for analysis')
    return {
      strategicScore: null,
      pagesAnalyzed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    }
  }

  console.error(`[AI Phase] Analyzing ${pageContents.length} pages with Claude`)

  const startTime = Date.now()
  const batchResult = await runAIAnalysis(pageContents)
  const executionTimeMs = Date.now() - startTime

  await logUsage('anthropic', 'ai_analysis', {
    organizationId,
    feature: UsageFeature.SiteAudit,
    tokensInput: batchResult.totalInputTokens,
    tokensOutput: batchResult.totalOutputTokens,
    cost: batchResult.totalCost,
    metadata: { auditId, pagesAnalyzed: batchResult.analyses.length },
  })

  // Build importance lookup from topPages
  const importanceLookup = new Map(topPages.map((p) => [p.url, p]))

  // Map analyses to audit_ai_analyses rows and insert
  const aiAnalysisRows: Omit<AuditAIAnalysis, 'id' | 'created_at'>[] = batchResult.analyses.map(
    (analysis) => {
      const importance = importanceLookup.get(analysis.url)
      return {
        audit_id: auditId,
        page_url: analysis.url,
        importance_score: importance?.importanceScore ?? 0,
        importance_reasons: importance?.reasons ?? [],
        score_data_quality: analysis.scores.dataQuality,
        score_expert_credibility: analysis.scores.expertCredibility,
        score_comprehensiveness: analysis.scores.comprehensiveness,
        score_citability: analysis.scores.citability,
        score_authority: analysis.scores.authority,
        score_overall: analysis.scores.overall,
        findings: (analysis.findings ?? {}) as Record<string, unknown>,
        recommendations: analysis.recommendations as unknown as Record<string, unknown>,
        platform_readiness: null,
        citability_passages: null,
        input_tokens: Math.round(batchResult.totalInputTokens / batchResult.analyses.length),
        output_tokens: Math.round(batchResult.totalOutputTokens / batchResult.analyses.length),
        cost: batchResult.totalCost / batchResult.analyses.length,
        execution_time_ms: Math.round(executionTimeMs / batchResult.analyses.length),
      }
    }
  )

  if (aiAnalysisRows.length > 0) {
    const { error } = await supabase.from('audit_ai_analyses').insert(aiAnalysisRows)
    if (error) {
      console.error('[AI Phase] Failed to insert AI analyses:', error)
    }
  }

  // Update audit record with token/cost totals
  await supabase
    .from('audits')
    .update({
      total_input_tokens: batchResult.totalInputTokens,
      total_output_tokens: batchResult.totalOutputTokens,
      total_cost: batchResult.totalCost,
    })
    .eq('id', auditId)

  const strategicScore = calculateStrategicScore(batchResult.analyses)

  console.error(
    `[AI Phase] Completed: ${batchResult.analyses.length} pages, strategic score=${strategicScore}, cost=$${batchResult.totalCost.toFixed(4)}`
  )

  return {
    strategicScore,
    pagesAnalyzed: batchResult.analyses.length,
    totalInputTokens: batchResult.totalInputTokens,
    totalOutputTokens: batchResult.totalOutputTokens,
    totalCost: batchResult.totalCost,
  }
}
