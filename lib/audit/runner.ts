import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite } from './crawler'
import { siteWideChecks, pageSpecificChecks } from './checks'
import { fetchPage } from './fetcher'
import { generateExecutiveSummary } from './summary'
import type { SiteAuditCheck, CheckContext, AuditStatus, DismissedCheck } from './types'

async function checkIfStopped(
  supabase: ReturnType<typeof createServiceClient>,
  auditId: string
): Promise<boolean> {
  const { data } = await supabase.from('site_audits').select('status').eq('id', auditId).single()
  return data?.status === 'stopped'
}

function isDismissed(dismissedChecks: DismissedCheck[], checkName: string, url: string): boolean {
  return dismissedChecks.some((d) => d.check_name === checkName && d.url === url)
}

export async function runAudit(auditId: string, url: string): Promise<void> {
  // Use service role client for background task (bypasses RLS)
  const supabase = createServiceClient()
  let wasStopped = false

  // Update status to crawling
  await supabase
    .from('site_audits')
    .update({ status: 'crawling', started_at: new Date().toISOString() })
    .eq('id', auditId)

  try {
    // Fetch organization_id for this audit and load dismissed checks
    const { data: auditData } = await supabase
      .from('site_audits')
      .select('organization_id')
      .eq('id', auditId)
      .single()

    const dismissedChecks: DismissedCheck[] = []
    if (auditData?.organization_id) {
      const { data: dismissed } = await supabase
        .from('dismissed_checks')
        .select('*')
        .eq('organization_id', auditData.organization_id)

      if (dismissed) {
        dismissedChecks.push(...dismissed)
      }
    }
    // Track crawled pages count for progress updates
    let pagesCrawledCount = 0

    // Crawl the site with stop signal support (no page limit)
    const { pages, errors: crawlErrors, stopped: crawlStopped } = await crawlSite(url, auditId, {
      onPageCrawled: async (page) => {
        // Save page to database
        const { error: pageInsertError } = await supabase.from('site_audit_pages').insert(page)
        if (pageInsertError) {
          console.error(`[Audit] Failed to insert page ${page.url}:`, pageInsertError)
        }

        // Increment and update pages_crawled count
        pagesCrawledCount++
        await supabase
          .from('site_audits')
          .update({ pages_crawled: pagesCrawledCount })
          .eq('id', auditId)
      },
      shouldStop: () => checkIfStopped(supabase, auditId),
    })

    wasStopped = crawlStopped

    // If we have no pages, fail the audit with an error message
    if (pages.length === 0) {
      const finalStatus: AuditStatus = wasStopped ? 'stopped' : 'failed'
      const errorMessage = wasStopped
        ? 'Audit was stopped before any pages were crawled'
        : crawlErrors.length > 0
          ? `Could not crawl the website: ${crawlErrors[0]}`
          : 'Could not crawl the website. The site may be unreachable or blocking our crawler.'

      console.error('[Audit Runner] No pages crawled', {
        auditId,
        url,
        errors: crawlErrors,
        timestamp: new Date().toISOString(),
      })

      await supabase
        .from('site_audits')
        .update({
          status: finalStatus,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditId)
      return
    }

    // Update status to checking (unless already stopped, then keep checking but note it)
    if (!wasStopped) {
      await supabase
        .from('site_audits')
        .update({ status: 'checking' as const })
        .eq('id', auditId)
    }

    const allCheckResults: SiteAuditCheck[] = []

    // Find the homepage for site-wide checks
    const homepage =
      pages.find((p) => {
        const pageUrl = new URL(p.url)
        return pageUrl.pathname === '/' || pageUrl.pathname === ''
      }) || pages[0]

    // Run site-wide checks once (using homepage context)
    const { html: homepageHtml } = await fetchPage(homepage.url)
    const siteWideContext: CheckContext = {
      url: homepage.url,
      html: homepageHtml,
      title: homepage.title,
      statusCode: homepage.status_code ?? 200,
      allPages: pages,
    }

    // Get base URL for site-wide dismissal checks
    const baseUrl = new URL(url).origin

    for (const check of siteWideChecks) {
      // Skip dismissed checks
      if (isDismissed(dismissedChecks, check.name, baseUrl)) {
        continue
      }

      try {
        const result = await check.run(siteWideContext)

        const checkResult: SiteAuditCheck = {
          id: crypto.randomUUID(),
          audit_id: auditId,
          page_id: null, // Site-wide checks have no specific page
          check_type: check.type,
          check_name: check.name,
          priority: check.priority,
          status: result.status,
          details: result.details ?? null,
          created_at: new Date().toISOString(),
          display_name: check.displayName,
          display_name_passed: check.displayNamePassed,
          learn_more_url: check.learnMoreUrl,
          is_site_wide: true,
          description: check.description,
          fix_guidance: check.fixGuidance || (result.details?.message as string) || undefined,
        }

        allCheckResults.push(checkResult)
        const { error: insertError } = await supabase.from('site_audit_checks').insert(checkResult)
        if (insertError) {
          console.error(`[Audit] Failed to insert site-wide check ${check.name}:`, insertError)
        }
      } catch (error) {
        console.error(`[Audit] Site-wide check ${check.name} failed:`, error)
      }
    }

    // Run page-specific checks on each page (skip resources like PDFs)
    const htmlPages = pages.filter((p) => !p.is_resource)
    const resourcePages = pages.filter((p) => p.is_resource)

    console.log(
      `[Audit] Starting page-specific checks for ${htmlPages.length} HTML pages (skipping ${resourcePages.length} resources), ${pageSpecificChecks.length} checks per page`
    )

    for (let i = 0; i < htmlPages.length; i++) {
      const page = htmlPages[i]

      // Check for stop signal every page during checking phase
      if (!wasStopped && i > 0) {
        if (await checkIfStopped(supabase, auditId)) {
          wasStopped = true
          // Continue checking remaining pages we've already crawled
        }
      }

      const { html } = await fetchPage(page.url)

      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title,
        statusCode: page.status_code ?? 200,
        allPages: pages,
      }

      for (const check of pageSpecificChecks) {
        // Skip dismissed checks
        if (isDismissed(dismissedChecks, check.name, page.url)) {
          continue
        }

        try {
          const result = await check.run(context)

          const checkResult: SiteAuditCheck = {
            id: crypto.randomUUID(),
            audit_id: auditId,
            page_id: page.id,
            check_type: check.type,
            check_name: check.name,
            priority: check.priority,
            status: result.status,
            details: result.details ?? null,
            created_at: new Date().toISOString(),
            display_name: check.displayName,
            display_name_passed: check.displayNamePassed,
            learn_more_url: check.learnMoreUrl,
            is_site_wide: false,
            description: check.description,
            fix_guidance: check.fixGuidance || (result.details?.message as string) || undefined,
          }

          allCheckResults.push(checkResult)
          const { error: insertError } = await supabase
            .from('site_audit_checks')
            .insert(checkResult)
          if (insertError) {
            console.error(`[Audit] Failed to insert check ${check.name}:`, insertError)
          }
        } catch (error) {
          console.error(`[Audit] Check ${check.name} failed:`, error)
        }
      }

      // Log progress every 10 pages
      if (i > 0 && i % 10 === 0) {
        console.log(
          `[Audit] Processed ${i}/${htmlPages.length} pages, ${allCheckResults.length} total checks so far`
        )
      }
    }

    console.log(`[Audit] Finished all checks. Total: ${allCheckResults.length}`)

    // Calculate scores
    const scores = calculateScores(allCheckResults)

    // Generate executive summary
    let executive_summary: string | null = null
    try {
      executive_summary = await generateExecutiveSummary(url, pages.length, scores, allCheckResults)
    } catch (error) {
      console.error('[Audit] Failed to generate executive summary:', error)
    }

    // Update audit with scores and summary - use 'stopped' status if was stopped
    const finalStatus: AuditStatus = wasStopped ? 'stopped' : 'completed'
    await supabase
      .from('site_audits')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        executive_summary,
        ...scores,
      })
      .eq('id', auditId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    console.error('[Audit Runner Error]', {
      type: 'audit_failed',
      auditId,
      url,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    await supabase
      .from('site_audits')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}

export function calculateScores(checks: SiteAuditCheck[]) {
  const scoreByType = (type: string) => {
    const typeChecks = checks.filter((c) => c.check_type === type)
    if (typeChecks.length === 0) return 100

    const weights = { critical: 3, recommended: 2, optional: 1 }
    let totalWeight = 0
    let earnedWeight = 0

    for (const check of typeChecks) {
      const weight = weights[check.priority as keyof typeof weights]
      totalWeight += weight
      if (check.status === 'passed') {
        earnedWeight += weight
      } else if (check.status === 'warning') {
        earnedWeight += weight * 0.5
      }
    }

    return Math.round((earnedWeight / totalWeight) * 100)
  }

  const seo_score = scoreByType('seo')
  const ai_readiness_score = scoreByType('ai_readiness')
  const technical_score = scoreByType('technical')
  const overall_score = Math.round((seo_score + ai_readiness_score + technical_score) / 3)

  // Count by status
  const failed_count = checks.filter((c) => c.status === 'failed').length
  const warning_count = checks.filter((c) => c.status === 'warning').length
  const passed_count = checks.filter((c) => c.status === 'passed').length

  return {
    overall_score,
    seo_score,
    ai_readiness_score,
    technical_score,
    failed_count,
    warning_count,
    passed_count,
  }
}
