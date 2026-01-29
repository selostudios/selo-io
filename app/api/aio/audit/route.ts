import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAIOChecks } from '@/lib/aio/runner'
import { runAIAnalysis, calculateStrategicScore } from '@/lib/aio/ai-auditor'
import { selectTopPages } from '@/lib/aio/importance'
import { crawlSite } from '@/lib/audit/crawler'
import type { AIOCheck } from '@/lib/aio/types'

interface CreateAuditRequest {
  organizationId: string | null
  url: string
  sampleSize: number
}

/**
 * POST /api/aio/audit
 * Creates and runs a AIO audit with Server-Sent Events (SSE) streaming
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  try {
    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = (await req.json()) as CreateAuditRequest
    const { organizationId, url, sampleSize } = body

    // Validate inputs
    if (!url || !sampleSize || sampleSize < 1 || sampleSize > 10) {
      return NextResponse.json(
        { error: 'Invalid request. URL and sampleSize (1-10) required.' },
        { status: 400 }
      )
    }

    // Create audit record
    const { data: audit, error: createError } = await supabase
      .from('aio_audits')
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        url,
        status: 'pending',
        sample_size: sampleSize,
        ai_analysis_enabled: true,
      })
      .select()
      .single()

    if (createError || !audit) {
      console.error('[AIO API] Failed to create audit:', createError)
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
    }

    // Set up SSE stream
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Start processing in background
    processAudit(audit.id, url, sampleSize, writer, encoder).catch((error) => {
      console.error('[AIO API] Audit processing failed:', error)
    })

    // Return SSE response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[AIO API] Request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Process AIO audit in background with SSE streaming
 */
async function processAudit(
  auditId: string,
  url: string,
  sampleSize: number,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
) {
  const supabase = await createClient()
  const startTime = Date.now()

  try {
    // Update status: running
    await supabase
      .from('aio_audits')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', auditId)

    await sendEvent(writer, encoder, { type: 'status', status: 'running_programmatic' })

    // Step 1: Crawl site to get all pages
    const { pages } = await crawlSite(url, auditId, {
      maxPages: 50, // Crawl up to 50 pages to build importance ranking
    })

    await sendEvent(writer, encoder, {
      type: 'crawl_complete',
      pagesFound: pages.length,
    })

    // Step 2: Run programmatic checks
    const programmaticResult = await runAIOChecks({
      auditId,
      url,
      sampleSize,
      onCheckComplete: async (check: AIOCheck) => {
        // Save check to database
        await supabase.from('aio_checks').insert({
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

        // Stream check result to client
        await sendEvent(writer, encoder, {
          type: 'programmatic_check',
          check: {
            category: check.category,
            name: check.check_name,
            status: check.status,
            displayName: check.status === 'passed' ? check.display_name_passed : check.display_name,
          },
        })
      },
    })

    await sendEvent(writer, encoder, {
      type: 'programmatic_complete',
      technicalScore: programmaticResult.technicalScore,
    })

    // Step 3: Select top pages for AI analysis
    const topPages = selectTopPages(pages, url, sampleSize)

    await sendEvent(writer, encoder, {
      type: 'ai_selection',
      selectedPages: topPages.map((p) => ({
        url: p.url,
        importanceScore: p.importanceScore,
        reasons: p.reasons,
      })),
    })

    // Step 4: Fetch HTML for selected pages
    const pagesWithHtml = await Promise.all(
      topPages.map(async (pageImportance) => {
        const page = pages.find((p) => p.url === pageImportance.url)
        if (!page) return null

        // Fetch HTML (re-crawl to get full content)
        const response = await fetch(page.url)
        const html = await response.text()

        return {
          url: page.url,
          html,
        }
      })
    )

    const validPages = pagesWithHtml.filter((p) => p !== null) as Array<{
      url: string
      html: string
    }>

    // Step 5: Run AI analysis
    await sendEvent(writer, encoder, { type: 'status', status: 'running_ai' })

    const aiResult = await runAIAnalysis(validPages, {
      onBatchComplete: async (analyses, tokens, cost) => {
        // Save AI analyses to database
        for (const analysis of analyses) {
          await supabase.from('aio_ai_analyses').insert({
            audit_id: auditId,
            page_url: analysis.url,
            model_used: 'claude-opus-4-20250514',
            prompt_tokens: Math.floor(tokens.promptTokens / analyses.length),
            completion_tokens: Math.floor(tokens.completionTokens / analyses.length),
            total_tokens: Math.floor(
              (tokens.promptTokens + tokens.completionTokens) / analyses.length
            ),
            cost: cost / analyses.length,
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

        // Stream batch results to client
        await sendEvent(writer, encoder, {
          type: 'ai_batch_complete',
          analyses: analyses,
          tokens,
          cost,
        })
      },
    })

    // Step 6: Calculate final scores
    const strategicScore = calculateStrategicScore(aiResult.analyses)
    const overallScore = Math.round((programmaticResult.technicalScore + strategicScore) / 2)

    // Step 7: Update audit with final results
    const executionTime = Date.now() - startTime

    await supabase
      .from('aio_audits')
      .update({
        status: 'completed',
        technical_score: programmaticResult.technicalScore,
        strategic_score: strategicScore,
        overall_aio_score: overallScore,
        pages_analyzed: aiResult.analyses.length,
        total_input_tokens: aiResult.totalInputTokens,
        total_output_tokens: aiResult.totalOutputTokens,
        total_cost: aiResult.totalCost,
        execution_time_ms: executionTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    // Step 8: Send completion event
    await sendEvent(writer, encoder, {
      type: 'complete',
      auditId,
      technicalScore: programmaticResult.technicalScore,
      strategicScore,
      overallScore,
      executionTime,
      tokenUsage: {
        input: aiResult.totalInputTokens,
        output: aiResult.totalOutputTokens,
        total: aiResult.totalInputTokens + aiResult.totalOutputTokens,
      },
      cost: aiResult.totalCost,
    })

    await writer.close()
  } catch (error) {
    console.error('[AIO API] Processing error:', error)

    // Update audit status to failed
    await supabase
      .from('aio_audits')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    // Send error event
    await sendEvent(writer, encoder, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Audit processing failed',
    })

    await writer.close()
  }
}

/**
 * Helper to send SSE event
 */
async function sendEvent(writer: WritableStreamDefaultWriter, encoder: TextEncoder, data: unknown) {
  const message = `data: ${JSON.stringify(data)}\n\n`
  await writer.write(encoder.encode(message))
}
