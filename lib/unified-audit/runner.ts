import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite } from '@/lib/audit/crawler'
import { initializeCrawlQueue, crawlBatch } from './batch-crawler'
import { fetchPage } from '@/lib/audit/fetcher'
import { siteWideChecks, pageSpecificChecks } from './checks'
import {
  calculateSEOScore,
  calculatePerformanceScore,
  calculateAIReadinessScore,
  calculateOverallScore,
} from './scoring'
import { UnifiedAuditStatus, CheckStatus } from '@/lib/enums'
import type { AuditPage, AuditCheck, CheckContext, AuditCheckDefinition } from './types'
import { runPSIAnalysis } from './psi-runner'
import { runAIAnalysisPhase } from './ai-runner'

// Budget for starting new batches: 800s max function timeout minus 300s buffer
const MAX_FUNCTION_DURATION_MS = 500_000

// Explicit column selects to avoid fetching unused columns (cast as '*' for Supabase type inference)
const AUDIT_CHECK_SELECT = `id, audit_id, page_url, category, check_name, priority, status,
  display_name, display_name_passed, description, fix_guidance,
  learn_more_url, details, feeds_scores, created_at` as '*'

const AUDIT_PAGE_SELECT = `id, audit_id, url, title, meta_description, status_code,
  last_modified, is_resource, resource_type, depth, created_at` as '*'

// =============================================================================
// Helpers
// =============================================================================

interface DismissedCheck {
  id: string
  organization_id: string
  check_name: string
  url: string
  dismissed_by: string
  created_at: string
}

async function checkIfStopped(
  supabase: ReturnType<typeof createServiceClient>,
  auditId: string
): Promise<boolean> {
  const { data } = await supabase.from('audits').select('status').eq('id', auditId).single()
  return data?.status === UnifiedAuditStatus.Stopped
}

function isDismissed(dismissedChecks: DismissedCheck[], checkName: string, url: string): boolean {
  return dismissedChecks.some((d) => d.check_name === checkName && d.url === url)
}

/**
 * Map AuditPage[] to the allPages format expected by CheckContext.
 */
function toCheckContextPages(pages: AuditPage[]): NonNullable<CheckContext['allPages']> {
  return pages.map((p) => ({
    url: p.url,
    title: p.title,
    statusCode: p.status_code,
    metaDescription: p.meta_description,
    isResource: p.is_resource,
  }))
}

/**
 * Build a check result record for insertion into the audit_checks table.
 */
export function buildCheckRecord(
  auditId: string,
  pageUrl: string | null,
  check: AuditCheckDefinition,
  result: { status: string; details?: Record<string, unknown> }
): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: auditId,
    page_url: pageUrl,
    category: check.category,
    check_name: check.name,
    priority: check.priority,
    status: result.status as AuditCheck['status'],
    display_name: check.displayName,
    display_name_passed: check.displayNamePassed ?? check.displayName,
    description: check.description,
    fix_guidance: check.fixGuidance ?? (result.details?.message as string) ?? null,
    learn_more_url: check.learnMoreUrl ?? null,
    details: result.details ?? null,
    feeds_scores: check.feedsScores,
    created_at: new Date().toISOString(),
  }
}

async function loadDismissedChecks(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string | null
): Promise<DismissedCheck[]> {
  if (!organizationId) return []

  const { data: dismissed } = await supabase
    .from('dismissed_checks')
    .select('id, organization_id, check_name, url, dismissed_by, created_at')
    .eq('organization_id', organizationId)

  return (dismissed as DismissedCheck[]) ?? []
}

// =============================================================================
// Core Runner (non-batched, for small sites)
// =============================================================================

/**
 * Run a complete unified audit synchronously.
 * Best for sites with a known small page count (standard mode).
 */
export async function runUnifiedAudit(auditId: string, url: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Fetch audit record
    const { data: audit } = await supabase
      .from('audits')
      .select('id, organization_id, max_pages, sample_size, ai_analysis_enabled')
      .eq('id', auditId)
      .single()

    if (!audit) {
      throw new Error('Audit not found')
    }

    const dismissedChecks = await loadDismissedChecks(supabase, audit.organization_id)

    // Phase 1: Crawl
    await supabase
      .from('audits')
      .update({ status: UnifiedAuditStatus.Crawling, started_at: new Date().toISOString() })
      .eq('id', auditId)

    let pagesCrawledCount = 0
    const allPages: AuditPage[] = []
    const allCheckResults: AuditCheck[] = []

    const {
      pages,
      errors: crawlErrors,
      stopped: crawlStopped,
    } = await crawlSite(url, auditId, {
      maxPages: audit.max_pages,
      onPageCrawled: async (crawledPage, html: string) => {
        // Save to unified audit_pages table
        const page: AuditPage = {
          id: crawledPage.id,
          audit_id: auditId,
          url: crawledPage.url,
          title: crawledPage.title,
          meta_description: crawledPage.meta_description,
          status_code: crawledPage.status_code,
          last_modified: crawledPage.last_modified,
          is_resource: crawledPage.is_resource ?? false,
          resource_type: crawledPage.resource_type ?? null,
          depth: 0,
          created_at: new Date().toISOString(),
        }

        await supabase.from('audit_pages').insert(page)
        allPages.push(page)

        pagesCrawledCount++
        await supabase
          .from('audits')
          .update({ pages_crawled: pagesCrawledCount, updated_at: new Date().toISOString() })
          .eq('id', auditId)

        // Skip checks for resources and error pages
        if (page.is_resource || (page.status_code && page.status_code >= 400)) {
          return
        }

        // Run page-specific checks
        const context: CheckContext = {
          url: page.url,
          html,
          title: page.title ?? undefined,
          statusCode: page.status_code ?? 200,
          allPages: toCheckContextPages(allPages),
        }

        const checksToRun = pageSpecificChecks.filter(
          (check) => !isDismissed(dismissedChecks, check.name, page.url)
        )

        const checkPromises = checksToRun.map(async (check) => {
          try {
            const result = await check.run(context)
            return buildCheckRecord(auditId, page.url, check, result)
          } catch (error) {
            console.error(`[Unified Audit] Check ${check.name} failed:`, error)
            return null
          }
        })

        const pageCheckResults = (await Promise.all(checkPromises)).filter(
          (r): r is AuditCheck => r !== null
        )

        if (pageCheckResults.length > 0) {
          allCheckResults.push(...pageCheckResults)
          await supabase.from('audit_checks').insert(pageCheckResults)
        }
      },
      shouldStop: () => checkIfStopped(supabase, auditId),
    })

    // Handle no pages crawled
    if (pages.length === 0) {
      const finalStatus = crawlStopped ? UnifiedAuditStatus.Stopped : UnifiedAuditStatus.Failed
      const errorMessage = crawlStopped
        ? 'Audit was stopped before any pages were crawled'
        : crawlErrors.length > 0
          ? `Could not crawl the website: ${crawlErrors[0]}`
          : 'Could not crawl the website. The site may be unreachable or blocking our crawler.'

      console.error('[Unified Audit Runner] No pages crawled', {
        auditId,
        url,
        errors: crawlErrors,
        timestamp: new Date().toISOString(),
      })

      await supabase
        .from('audits')
        .update({
          status: finalStatus,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditId)
      return
    }

    if (crawlStopped) {
      await completeAuditScoring(auditId, url, allPages, allCheckResults, null)
      return
    }

    // Phase 2: Site-wide checks
    await runSiteWideChecks(auditId, url, allPages, allCheckResults, dismissedChecks)

    // Phase 3: PSI + AI analysis (parallel)
    const analysisResults = await runAnalysisPhase(
      auditId,
      url,
      allPages,
      allCheckResults,
      audit.sample_size ?? 5,
      audit.ai_analysis_enabled ?? true
    )

    // Phase 4: Scoring
    await completeAuditScoring(
      auditId,
      url,
      allPages,
      analysisResults.checkResults,
      analysisResults.strategicScore
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    console.error('[Unified Audit Runner Error]', {
      type: 'audit_failed',
      auditId,
      url,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    await supabase
      .from('audits')
      .update({
        status: UnifiedAuditStatus.Failed,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  }
}

// =============================================================================
// Batched Runner (for large sites with timeout-based continuation)
// =============================================================================

/**
 * Run a unified audit in batch mode with timeout-based self-continuation.
 * Reuses initializeCrawlQueue/crawlBatch from lib/audit/batch-crawler.ts
 * but saves pages to unified `audit_pages` table.
 */
export async function runUnifiedAuditBatch(auditId: string, url: string): Promise<void> {
  const supabase = createServiceClient()
  const functionStartTime = Date.now()

  try {
    // Fetch audit data
    const { data: audit } = await supabase
      .from('audits')
      .select(
        'id, organization_id, current_batch, max_pages, crawl_mode, sample_size, ai_analysis_enabled'
      )
      .eq('id', auditId)
      .single()

    if (!audit) {
      throw new Error('Audit not found')
    }

    let currentBatch = audit.current_batch || 0
    const dismissedChecks = await loadDismissedChecks(supabase, audit.organization_id)

    // First batch: initialize queue
    if (currentBatch === 0) {
      await supabase
        .from('audits')
        .update({
          status: UnifiedAuditStatus.Crawling,
          started_at: new Date().toISOString(),
          current_batch: 1,
        })
        .eq('id', auditId)

      await initializeCrawlQueue(auditId, url)
      currentBatch = 1
    }

    // Process batches in a loop
    while (true) {
      const elapsed = Date.now() - functionStartTime
      if (elapsed > MAX_FUNCTION_DURATION_MS) {
        console.log(
          `[Unified Audit Batch] Approaching function timeout (${Math.round(elapsed / 1000)}s), triggering continuation`
        )
        await supabase
          .from('audits')
          .update({ status: UnifiedAuditStatus.BatchComplete })
          .eq('id', auditId)
        await triggerContinuation(auditId)
        return
      }

      // Update batch counter
      if (currentBatch > (audit.current_batch || 0)) {
        await supabase
          .from('audits')
          .update({
            status: UnifiedAuditStatus.Crawling,
            current_batch: currentBatch,
            updated_at: new Date().toISOString(),
          })
          .eq('id', auditId)
      }

      // Run the batch crawl
      const result = await crawlBatch(auditId, { dismissedChecks })

      console.log(
        `[Unified Audit Batch] Batch ${currentBatch} complete: ${result.pagesProcessed} pages, hasMore=${result.hasMorePages}, stopped=${result.stopped}`
      )

      if (result.stopped) {
        await finishUnifiedAudit(auditId, url, dismissedChecks, true)
        return
      } else if (result.hasMorePages) {
        // Check for exhaustive mode soft cap
        const { data: freshAudit } = await supabase
          .from('audits')
          .select('crawl_mode, max_pages, pages_crawled, soft_cap_reached')
          .eq('id', auditId)
          .single()

        if (
          freshAudit?.crawl_mode === 'exhaustive' &&
          !freshAudit.soft_cap_reached &&
          freshAudit.pages_crawled >= freshAudit.max_pages
        ) {
          // Soft cap reached in exhaustive mode — pause for user confirmation
          await supabase
            .from('audits')
            .update({
              status: UnifiedAuditStatus.AwaitingConfirmation,
              soft_cap_reached: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', auditId)
          return
        }

        currentBatch++
        continue
      } else {
        // No more pages — finish
        await finishUnifiedAudit(auditId, url, dismissedChecks, false)
        return
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    console.error('[Unified Audit Batch Error]', {
      type: 'batch_failed',
      auditId,
      url,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })

    await supabase
      .from('audits')
      .update({
        status: UnifiedAuditStatus.Failed,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  }
}

// =============================================================================
// Site-wide Checks
// =============================================================================

async function runSiteWideChecks(
  auditId: string,
  url: string,
  allPages: AuditPage[],
  allCheckResults: AuditCheck[],
  dismissedChecks: DismissedCheck[]
): Promise<void> {
  const supabase = createServiceClient()

  await supabase.from('audits').update({ status: UnifiedAuditStatus.Checking }).eq('id', auditId)

  // Find homepage
  const homepage =
    allPages.find((p) => {
      const pageUrl = new URL(p.url)
      return pageUrl.pathname === '/' || pageUrl.pathname === ''
    }) || allPages[0]

  // Fetch homepage HTML fresh for site-wide checks
  const { html: homepageHtml } = await fetchPage(homepage.url)
  const siteWideContext: CheckContext = {
    url: homepage.url,
    html: homepageHtml,
    title: homepage.title ?? undefined,
    statusCode: homepage.status_code ?? 200,
    allPages: toCheckContextPages(allPages),
  }

  const baseUrl = new URL(url).origin

  for (const check of siteWideChecks) {
    if (isDismissed(dismissedChecks, check.name, baseUrl)) {
      continue
    }

    try {
      const result = await check.run(siteWideContext)
      const checkResult = buildCheckRecord(auditId, null, check, result)

      allCheckResults.push(checkResult)
      await supabase.from('audit_checks').insert(checkResult)
    } catch (error) {
      console.error(`[Unified Audit] Site-wide check ${check.name} failed:`, error)
    }
  }
}

// =============================================================================
// PSI + AI Analysis Phase
// =============================================================================

interface AnalysisPhaseResult {
  checkResults: AuditCheck[]
  strategicScore: number | null
}

/**
 * Run PSI and AI analysis in parallel after site-wide checks.
 * If PSI upserted checks, re-fetches all checks from DB to get fresh data.
 */
async function runAnalysisPhase(
  auditId: string,
  url: string,
  allPages: AuditPage[],
  currentCheckResults: AuditCheck[],
  sampleSize: number,
  aiAnalysisEnabled: boolean
): Promise<AnalysisPhaseResult> {
  const supabase = createServiceClient()

  // Set status to Analyzing
  await supabase.from('audits').update({ status: UnifiedAuditStatus.Analyzing }).eq('id', auditId)

  // Run PSI and AI in parallel
  const [psiResult, aiResult] = await Promise.allSettled([
    runPSIAnalysis(auditId, url, allPages, sampleSize),
    runAIAnalysisPhase(auditId, url, allPages, sampleSize, aiAnalysisEnabled),
  ])

  const psiData = psiResult.status === 'fulfilled' ? psiResult.value : null
  const aiData = aiResult.status === 'fulfilled' ? aiResult.value : null

  if (psiResult.status === 'rejected') {
    console.error('[Unified Audit] PSI analysis failed:', psiResult.reason)
  }
  if (aiResult.status === 'rejected') {
    console.error('[Unified Audit] AI analysis failed:', aiResult.reason)
  }

  // If PSI upserted checks, re-fetch all checks from DB (in-memory array is stale)
  let checkResults = currentCheckResults
  if (psiData && psiData.checksUpserted > 0) {
    const { data: freshChecks } = await supabase
      .from('audit_checks')
      .select(AUDIT_CHECK_SELECT)
      .eq('audit_id', auditId)

    if (freshChecks) {
      checkResults = freshChecks as AuditCheck[]
    }
  }

  return {
    checkResults,
    strategicScore: aiData?.strategicScore ?? null,
  }
}

// =============================================================================
// Scoring & Completion
// =============================================================================

async function completeAuditScoring(
  auditId: string,
  _url: string,
  _allPages: AuditPage[],
  allCheckResults: AuditCheck[],
  strategicScore: number | null = null
): Promise<void> {
  const supabase = createServiceClient()

  const seoScore = calculateSEOScore(allCheckResults)
  const performanceScore = calculatePerformanceScore(allCheckResults)
  const aiReadinessScore = calculateAIReadinessScore(allCheckResults, strategicScore)
  const overallScore = calculateOverallScore(seoScore, performanceScore, aiReadinessScore)

  // Count by status
  const failedCount = allCheckResults.filter((c) => c.status === CheckStatus.Failed).length
  const warningCount = allCheckResults.filter((c) => c.status === CheckStatus.Warning).length
  const passedCount = allCheckResults.filter((c) => c.status === CheckStatus.Passed).length

  await supabase
    .from('audits')
    .update({
      status: UnifiedAuditStatus.Completed,
      overall_score: overallScore,
      seo_score: seoScore,
      performance_score: performanceScore,
      ai_readiness_score: aiReadinessScore,
      failed_count: failedCount,
      warning_count: warningCount,
      passed_count: passedCount,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  console.log(
    `[Unified Audit] Audit ${auditId} completed. SEO=${seoScore}, Performance=${performanceScore}, AI=${aiReadinessScore}, Overall=${overallScore}`
  )
}

// =============================================================================
// Finish Batched Audit
// =============================================================================

/**
 * Finish a batched audit after all pages are crawled.
 * Runs site-wide checks, calculates scores, and completes the audit.
 */
async function finishUnifiedAudit(
  auditId: string,
  url: string,
  dismissedChecks: DismissedCheck[],
  wasStopped: boolean
): Promise<void> {
  const supabase = createServiceClient()

  // Update status to checking
  if (!wasStopped) {
    await supabase.from('audits').update({ status: UnifiedAuditStatus.Checking }).eq('id', auditId)
  }

  // Get all pages from the audit_pages table
  const { data: pages } = await supabase
    .from('audit_pages')
    .select(AUDIT_PAGE_SELECT)
    .eq('audit_id', auditId)

  const allPages: AuditPage[] = (pages || []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    audit_id: p.audit_id as string,
    url: p.url as string,
    title: p.title as string | null,
    meta_description: p.meta_description as string | null,
    status_code: p.status_code as number | null,
    last_modified: p.last_modified as string | null,
    is_resource: (p.is_resource as boolean) ?? false,
    resource_type: (p.resource_type as string | null) ?? null,
    depth: (p.depth as number) ?? 0,
    created_at: (p.created_at as string) ?? new Date().toISOString(),
  }))

  if (allPages.length === 0) {
    await supabase
      .from('audits')
      .update({
        status: UnifiedAuditStatus.Failed,
        error_message: 'No pages were crawled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
    return
  }

  // Get existing page-specific check results
  const { data: existingChecks } = await supabase
    .from('audit_checks')
    .select(AUDIT_CHECK_SELECT)
    .eq('audit_id', auditId)

  const allCheckResults: AuditCheck[] = (existingChecks || []) as AuditCheck[]

  // Run site-wide checks if not stopped
  if (!wasStopped) {
    await runSiteWideChecks(auditId, url, allPages, allCheckResults, dismissedChecks)
  }

  // Fetch audit config for analysis phase
  const { data: auditConfig } = await supabase
    .from('audits')
    .select('sample_size, ai_analysis_enabled')
    .eq('id', auditId)
    .single()

  // Run PSI + AI analysis (skip if stopped)
  let strategicScore: number | null = null
  let finalCheckResults = allCheckResults

  if (!wasStopped) {
    const analysisResults = await runAnalysisPhase(
      auditId,
      url,
      allPages,
      allCheckResults,
      auditConfig?.sample_size ?? 5,
      auditConfig?.ai_analysis_enabled ?? true
    )
    strategicScore = analysisResults.strategicScore
    finalCheckResults = analysisResults.checkResults
  }

  // Scoring
  await completeAuditScoring(auditId, url, allPages, finalCheckResults, strategicScore)
}

// =============================================================================
// Self-continuation
// =============================================================================

async function triggerContinuation(auditId: string): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (!baseUrl) {
    console.error('[Unified Audit Continuation] No base URL configured, cannot self-trigger')
    return
  }

  try {
    const response = await fetch(`${baseUrl}/api/unified-audit/${auditId}/continue`, {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.error('[Unified Audit Continuation] Failed to trigger:', response.status)
    }
  } catch (err) {
    console.error('[Unified Audit Continuation] Failed to self-trigger:', err)
  }
}

// =============================================================================
// Exports for programmatic check running (used in tests)
// =============================================================================

export { runSiteWideChecks, completeAuditScoring }
