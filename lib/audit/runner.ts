import { createServiceClient } from '@/lib/supabase/server'
import { crawlSite } from './crawler'
import { siteWideChecks, pageSpecificChecks } from './checks'
import { fetchPage } from './fetcher'
import { generateExecutiveSummary } from './summary'
import { initializeCrawlQueue, crawlBatch } from './batch-crawler'
import type { SiteAuditCheck, SiteAuditPage, CheckContext, AuditStatus, DismissedCheck } from './types'

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

    // Collect all check results and page data during crawling
    const allCheckResults: SiteAuditCheck[] = []
    const allPages: import('./types').SiteAuditPage[] = []

    // Crawl the site with stop signal support (no page limit)
    // Run page-specific checks during crawling to avoid re-fetching pages
    const {
      pages,
      errors: crawlErrors,
      stopped: crawlStopped,
    } = await crawlSite(url, auditId, {
      onPageCrawled: async (page, html) => {
        // Save page to database
        const { error: pageInsertError } = await supabase.from('site_audit_pages').insert(page)
        if (pageInsertError) {
          console.error(`[Audit] Failed to insert page ${page.url}:`, pageInsertError)
        }

        // Track all pages for site-wide checks later
        allPages.push(page)

        // Increment and update pages_crawled count (with timestamp to prevent stale audit detection)
        pagesCrawledCount++
        await supabase
          .from('site_audits')
          .update({ pages_crawled: pagesCrawledCount, updated_at: new Date().toISOString() })
          .eq('id', auditId)

        // Skip page-specific checks for resources (PDFs, images, etc.)
        if (page.is_resource) {
          return
        }

        // Run page-specific checks immediately while we have the HTML
        const context: CheckContext = {
          url: page.url,
          html,
          title: page.title,
          statusCode: page.status_code ?? 200,
          allPages, // Note: this is incomplete during crawling, but page-specific checks don't use it
        }

        // Filter checks that aren't dismissed
        const checksToRun = pageSpecificChecks.filter(
          (check) => !isDismissed(dismissedChecks, check.name, page.url)
        )

        // Run all checks for this page in parallel for speed
        const checkPromises = checksToRun.map(async (check) => {
          try {
            const result = await check.run(context)
            return {
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
            } as SiteAuditCheck
          } catch (error) {
            console.error(`[Audit] Check ${check.name} failed:`, error)
            return null
          }
        })

        const pageCheckResults = (await Promise.all(checkPromises)).filter(
          (r): r is SiteAuditCheck => r !== null
        )

        // Batch insert all checks for this page at once
        if (pageCheckResults.length > 0) {
          allCheckResults.push(...pageCheckResults)
          const { error: insertError } = await supabase
            .from('site_audit_checks')
            .insert(pageCheckResults)
          if (insertError) {
            console.error(`[Audit] Failed to batch insert checks for ${page.url}:`, insertError)
          }
        }
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

    // Update status to checking for site-wide checks (page-specific checks already done during crawling)
    if (!wasStopped) {
      await supabase
        .from('site_audits')
        .update({ status: 'checking' as const })
        .eq('id', auditId)
    }

    console.log(
      `[Audit] Crawling complete. ${allPages.length} pages, ${allCheckResults.length} page-specific checks already done. Running site-wide checks...`
    )

    // Find the homepage for site-wide checks
    const homepage =
      allPages.find((p) => {
        const pageUrl = new URL(p.url)
        return pageUrl.pathname === '/' || pageUrl.pathname === ''
      }) || allPages[0]

    // Run site-wide checks once (using homepage context)
    // These require the full list of pages, so must run after crawling
    const { html: homepageHtml } = await fetchPage(homepage.url)
    const siteWideContext: CheckContext = {
      url: homepage.url,
      html: homepageHtml,
      title: homepage.title,
      statusCode: homepage.status_code ?? 200,
      allPages,
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

    console.log(`[Audit] Finished all checks. Total: ${allCheckResults.length}`)

    // Calculate scores
    const scores = calculateScores(allCheckResults)

    // Generate executive summary
    let executive_summary: string | null = null
    try {
      executive_summary = await generateExecutiveSummary(url, allPages.length, scores, allCheckResults)
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

/**
 * Run an audit in batch mode - processes ~50 pages per execution.
 * On first batch, initializes the crawl queue.
 * Returns 'batch_complete' status if more pages remain.
 */
export async function runAuditBatch(auditId: string, url: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Fetch audit data including batch tracking
    const { data: auditData } = await supabase
      .from('site_audits')
      .select('organization_id, current_batch, status')
      .eq('id', auditId)
      .single()

    if (!auditData) {
      throw new Error('Audit not found')
    }

    const currentBatch = auditData.current_batch || 0
    const isFirstBatch = currentBatch === 0

    // Load dismissed checks
    const dismissedChecks: DismissedCheck[] = []
    if (auditData.organization_id) {
      const { data: dismissed } = await supabase
        .from('dismissed_checks')
        .select('*')
        .eq('organization_id', auditData.organization_id)

      if (dismissed) {
        dismissedChecks.push(...dismissed)
      }
    }

    // First batch: initialize queue with start URL
    if (isFirstBatch) {
      await supabase
        .from('site_audits')
        .update({
          status: 'crawling',
          started_at: new Date().toISOString(),
          current_batch: 1,
        })
        .eq('id', auditId)

      await initializeCrawlQueue(auditId, url)
    } else {
      // Subsequent batches: increment batch counter
      await supabase
        .from('site_audits')
        .update({
          status: 'crawling',
          current_batch: currentBatch + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditId)
    }

    // Run the batch crawl
    const result = await crawlBatch(auditId, { dismissedChecks })

    console.log(
      `[Audit Batch] Batch ${currentBatch + 1} complete: ${result.pagesProcessed} pages, hasMore=${result.hasMorePages}, stopped=${result.stopped}`
    )

    // Handle results
    if (result.stopped) {
      // User stopped the audit - complete with current results
      await completeAuditWithExistingChecks(auditId, url)
    } else if (result.hasMorePages) {
      // More pages to crawl - signal batch complete
      await supabase.from('site_audits').update({ status: 'batch_complete' }).eq('id', auditId)
    } else {
      // No more pages - run site-wide checks and complete
      await finishAudit(auditId, url, dismissedChecks)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    console.error('[Audit Batch Error]', {
      type: 'batch_failed',
      auditId,
      url,
      error: errorMessage,
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
  }
}

/**
 * Finish an audit after all pages are crawled.
 * Runs site-wide checks, calculates scores, and generates summary.
 */
async function finishAudit(
  auditId: string,
  url: string,
  dismissedChecks: DismissedCheck[]
): Promise<void> {
  const supabase = createServiceClient()

  // Update status to checking
  await supabase.from('site_audits').update({ status: 'checking' }).eq('id', auditId)

  // Get all pages
  const { data: pages } = await supabase
    .from('site_audit_pages')
    .select('*')
    .eq('audit_id', auditId)

  const allPages = (pages as SiteAuditPage[]) || []

  if (allPages.length === 0) {
    await supabase
      .from('site_audits')
      .update({
        status: 'failed',
        error_message: 'No pages were crawled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
    return
  }

  // Find homepage for site-wide checks
  const homepage =
    allPages.find((p) => {
      const pageUrl = new URL(p.url)
      return pageUrl.pathname === '/' || pageUrl.pathname === ''
    }) || allPages[0]

  // Fetch homepage HTML for site-wide checks
  const { html: homepageHtml } = await fetchPage(homepage.url)
  const siteWideContext: CheckContext = {
    url: homepage.url,
    html: homepageHtml,
    title: homepage.title,
    statusCode: homepage.status_code ?? 200,
    allPages,
  }

  const baseUrl = new URL(url).origin
  const allCheckResults: SiteAuditCheck[] = []

  // Run site-wide checks
  for (const check of siteWideChecks) {
    if (isDismissed(dismissedChecks, check.name, baseUrl)) {
      continue
    }

    try {
      const result = await check.run(siteWideContext)

      const checkResult: SiteAuditCheck = {
        id: crypto.randomUUID(),
        audit_id: auditId,
        page_id: null,
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
      await supabase.from('site_audit_checks').insert(checkResult)
    } catch (error) {
      console.error(`[Audit Finish] Site-wide check ${check.name} failed:`, error)
    }
  }

  // Get all checks (page-specific + site-wide)
  const { data: allChecks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', auditId)

  const checksForScoring = (allChecks as SiteAuditCheck[]) || []

  // Calculate scores
  const scores = calculateScores(checksForScoring)

  // Generate executive summary
  let executive_summary: string | null = null
  try {
    executive_summary = await generateExecutiveSummary(
      url,
      allPages.length,
      scores,
      checksForScoring
    )
  } catch (error) {
    console.error('[Audit Finish] Failed to generate executive summary:', error)
  }

  // Complete the audit
  await supabase
    .from('site_audits')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      executive_summary,
      ...scores,
    })
    .eq('id', auditId)

  console.log(`[Audit Finish] Audit ${auditId} completed successfully`)
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

/**
 * Resume an audit that failed or was stopped during crawling.
 * Runs checks on already-crawled pages without re-crawling.
 */
export async function resumeAuditChecks(auditId: string, url: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Fetch audit data and dismissed checks
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

    // Fetch existing pages from the database
    const { data: existingPages, error: pagesError } = await supabase
      .from('site_audit_pages')
      .select('*')
      .eq('audit_id', auditId)
      .order('crawled_at', { ascending: true })

    if (pagesError || !existingPages || existingPages.length === 0) {
      throw new Error('No pages found for this audit')
    }

    const pages = existingPages as import('./types').SiteAuditPage[]
    console.log(`[Audit Resume] Starting checks for ${pages.length} existing pages`)

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
      if (isDismissed(dismissedChecks, check.name, baseUrl)) {
        continue
      }

      try {
        const result = await check.run(siteWideContext)

        const checkResult: SiteAuditCheck = {
          id: crypto.randomUUID(),
          audit_id: auditId,
          page_id: null,
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
        await supabase.from('site_audit_checks').insert(checkResult)
      } catch (error) {
        console.error(`[Audit Resume] Site-wide check ${check.name} failed:`, error)
      }
    }

    // Run page-specific checks on each HTML page (skip resources)
    const htmlPages = pages.filter((p) => !p.is_resource)

    console.log(`[Audit Resume] Running page-specific checks for ${htmlPages.length} HTML pages`)

    for (let i = 0; i < htmlPages.length; i++) {
      const page = htmlPages[i]
      const { html } = await fetchPage(page.url)

      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title,
        statusCode: page.status_code ?? 200,
        allPages: pages,
      }

      for (const check of pageSpecificChecks) {
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
          await supabase.from('site_audit_checks').insert(checkResult)
        } catch (error) {
          console.error(`[Audit Resume] Check ${check.name} failed:`, error)
        }
      }

      // Log progress every 10 pages
      if (i > 0 && i % 10 === 0) {
        console.log(`[Audit Resume] Processed ${i}/${htmlPages.length} pages`)
      }
    }

    console.log(`[Audit Resume] Finished all checks. Total: ${allCheckResults.length}`)

    // Calculate scores
    const scores = calculateScores(allCheckResults)

    // Generate executive summary
    let executive_summary: string | null = null
    try {
      executive_summary = await generateExecutiveSummary(url, pages.length, scores, allCheckResults)
    } catch (error) {
      console.error('[Audit Resume] Failed to generate executive summary:', error)
    }

    // Update audit with scores and summary
    await supabase
      .from('site_audits')
      .update({
        status: 'completed' as AuditStatus,
        completed_at: new Date().toISOString(),
        executive_summary,
        ...scores,
      })
      .eq('id', auditId)

    console.log(`[Audit Resume] Audit ${auditId} completed successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    console.error('[Audit Resume Error]', {
      type: 'resume_failed',
      auditId,
      url,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })

    await supabase
      .from('site_audits')
      .update({
        status: 'failed',
        error_message: `Failed to resume checks: ${errorMessage}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}

/**
 * Complete an audit that already has checks (from crawl-time checking).
 * Runs site-wide checks if missing, calculates scores, and completes the audit.
 */
export async function completeAuditWithExistingChecks(auditId: string, url: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    console.log(`[Audit Complete] Starting completion for audit ${auditId} with existing checks`)

    // Fetch existing checks from the database
    const { data: existingChecks, error: checksError } = await supabase
      .from('site_audit_checks')
      .select('*')
      .eq('audit_id', auditId)

    if (checksError) {
      throw new Error(`Failed to fetch existing checks: ${checksError.message}`)
    }

    const allCheckResults = (existingChecks || []) as SiteAuditCheck[]
    console.log(`[Audit Complete] Found ${allCheckResults.length} existing checks`)

    // Check if site-wide checks are already present
    const hasSiteWideChecks = allCheckResults.some((c) => c.is_site_wide)

    if (!hasSiteWideChecks) {
      console.log(`[Audit Complete] Running site-wide checks...`)

      // Fetch pages for site-wide checks
      const { data: pages } = await supabase
        .from('site_audit_pages')
        .select('*')
        .eq('audit_id', auditId)

      if (pages && pages.length > 0) {
        // Find homepage
        const homepage =
          pages.find((p) => {
            const pageUrl = new URL(p.url)
            return pageUrl.pathname === '/' || pageUrl.pathname === ''
          }) || pages[0]

        // Fetch homepage HTML for site-wide checks
        const { html: homepageHtml } = await fetchPage(homepage.url)
        const siteWideContext: CheckContext = {
          url: homepage.url,
          html: homepageHtml,
          title: homepage.title,
          statusCode: homepage.status_code ?? 200,
          allPages: pages as import('./types').SiteAuditPage[],
        }

        // Run site-wide checks
        for (const check of siteWideChecks) {
          try {
            const result = await check.run(siteWideContext)

            const checkResult: SiteAuditCheck = {
              id: crypto.randomUUID(),
              audit_id: auditId,
              page_id: null,
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
            await supabase.from('site_audit_checks').insert(checkResult)
          } catch (error) {
            console.error(`[Audit Complete] Site-wide check ${check.name} failed:`, error)
          }
        }
      }
    }

    console.log(`[Audit Complete] Calculating scores from ${allCheckResults.length} total checks`)

    // Calculate scores
    const scores = calculateScores(allCheckResults)

    // Get page count for summary
    const { count: pageCount } = await supabase
      .from('site_audit_pages')
      .select('*', { count: 'exact', head: true })
      .eq('audit_id', auditId)

    // Generate executive summary
    let executive_summary: string | null = null
    try {
      executive_summary = await generateExecutiveSummary(
        url,
        pageCount || 0,
        scores,
        allCheckResults
      )
    } catch (error) {
      console.error('[Audit Complete] Failed to generate executive summary:', error)
    }

    // Update audit with scores and summary
    await supabase
      .from('site_audits')
      .update({
        status: 'completed' as AuditStatus,
        completed_at: new Date().toISOString(),
        executive_summary,
        ...scores,
      })
      .eq('id', auditId)

    console.log(`[Audit Complete] Audit ${auditId} completed successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    console.error('[Audit Complete Error]', {
      type: 'complete_failed',
      auditId,
      url,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })

    await supabase
      .from('site_audits')
      .update({
        status: 'failed',
        error_message: `Failed to complete audit: ${errorMessage}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}
