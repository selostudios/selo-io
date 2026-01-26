import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite } from '@/lib/audit/crawler'
import { runGEOChecks } from './runner'
import { runAIAnalysis, calculateStrategicScore } from './ai-auditor'
import { selectTopPages } from './importance'
import type { GEOCheck } from './types'
import type { SiteAuditPage } from '@/lib/audit/types'

/**
 * Run a complete GEO audit in the background
 * Uses service client to bypass RLS since this runs without user context
 */
export async function runGEOAuditBackground(auditId: string, url: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    console.log(`[GEO Background] Starting audit ${auditId} for ${url}`)

    // Update status to 'running'
    await supabase
      .from('geo_audits')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', auditId)

    // Get audit details (need sample_size)
    const { data: audit } = await supabase
      .from('geo_audits')
      .select('sample_size, ai_analysis_enabled')
      .eq('id', auditId)
      .single()

    if (!audit) {
      throw new Error('Audit not found')
    }

    const startTime = Date.now()

    // Step 1: Run programmatic checks (saves to DB via callback)
    const { checks, technicalScore } = await runGEOChecks({
      auditId,
      url,
      sampleSize: audit.sample_size ?? 5,
      async onCheckComplete(check: GEOCheck) {
        // Save check to database
        await supabase.from('geo_checks').insert({
          audit_id: check.audit_id,
          category: check.category,
          check_name: check.check_name,
          priority: check.priority,
          status: check.status,
          details: check.details,
          display_name: check.display_name,
          display_name_passed: check.display_name_passed,
          description: check.description,
          fix_guidance: check.fix_guidance,
          learn_more_url: check.learn_more_url,
        })
      },
    })

    console.log(`[GEO Background] Programmatic checks complete: ${technicalScore}/100`)

    // Step 2: Crawl additional pages for AI analysis (if enabled)
    let strategicScore: number | null = null
    let overallScore = technicalScore
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCost = 0

    if (audit.ai_analysis_enabled && audit.sample_size > 0) {
      console.log(`[GEO Background] Crawling site for AI analysis (sample size: ${audit.sample_size})`)

      const pages: SiteAuditPage[] = []

      await crawlSite(url, auditId, {
        maxPages: Math.min(audit.sample_size * 3, 50), // Crawl extra pages for selection
        async onPageCrawled(page) {
          pages.push(page)
        },
      })

      // Step 3: Select top N most important pages
      const selectedPages = selectTopPages(pages, url, audit.sample_size)
      console.log(`[GEO Background] Selected ${selectedPages.length} pages for AI analysis`)

      // Step 4: Run AI analysis
      if (selectedPages.length > 0) {
        const pageContents = await Promise.all(
          selectedPages.map(async (p) => {
            // Fetch HTML from stored page
            const { data: pageData } = await supabase
              .from('site_audit_pages')
              .select('html')
              .eq('audit_id', auditId)
              .eq('url', p.url)
              .single()

            return {
              url: p.url,
              html: pageData?.html ?? '',
            }
          })
        )

        const aiResult = await runAIAnalysis(pageContents, {
          async onBatchComplete(analyses, tokens, cost) {
            // Save each analysis to database
            for (const analysis of analyses) {
              await supabase.from('geo_ai_analyses').insert({
                audit_id: auditId,
                page_url: analysis.url,
                importance_score: null,
                importance_reasons: null,
                model_used: 'claude-opus-4-20250514',
                prompt_tokens: tokens.promptTokens,
                completion_tokens: tokens.completionTokens,
                total_tokens: tokens.promptTokens + tokens.completionTokens,
                cost: cost,
                execution_time_ms: null,
                score_data_quality: analysis.scores.dataQuality,
                score_expert_credibility: analysis.scores.expertCredibility,
                score_comprehensiveness: analysis.scores.comprehensiveness,
                score_citability: analysis.scores.citability,
                score_authority: analysis.scores.authority,
                score_overall: analysis.scores.overall,
                findings: analysis.findings,
                recommendations: analysis.recommendations,
              })
            }

            console.log(
              `[GEO Background] AI batch complete: ${analyses.length} pages, ${tokens.promptTokens}/${tokens.completionTokens} tokens, $${cost.toFixed(4)}`
            )
          },
        })

        totalInputTokens = aiResult.totalInputTokens
        totalOutputTokens = aiResult.totalOutputTokens
        totalCost = aiResult.totalCost

        // Calculate strategic score
        strategicScore = calculateStrategicScore(aiResult.analyses)

        // Calculate overall score (weighted average of technical and strategic)
        overallScore = Math.round((technicalScore * 0.4) + (strategicScore * 0.6))

        console.log(`[GEO Background] AI analysis complete: strategic=${strategicScore}, overall=${overallScore}`)
      }
    }

    const executionTime = Date.now() - startTime

    // Step 5: Update audit with final scores
    await supabase
      .from('geo_audits')
      .update({
        status: 'completed',
        technical_score: technicalScore,
        strategic_score: strategicScore,
        overall_geo_score: overallScore,
        pages_analyzed: checks.length > 0 ? 1 : 0, // Will be updated when we track crawled pages
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_cost: totalCost,
        execution_time_ms: executionTime,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    console.log(`[GEO Background] Audit ${auditId} completed in ${(executionTime / 1000).toFixed(1)}s`)

  } catch (error) {
    console.error(`[GEO Background] Audit ${auditId} failed:`, error)

    // Update audit status to failed
    await supabase
      .from('geo_audits')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}
