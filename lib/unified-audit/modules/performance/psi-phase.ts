import { createServiceClient } from '@/lib/supabase/server'
import {
  fetchPageSpeedInsights,
  extractOpportunities,
  extractDiagnostics,
} from '@/lib/performance/api'
import type { PageSpeedResult } from '@/lib/performance/types'
import { selectTopPages } from '../../importance'
import { lighthouseScores } from '../../checks/performance/lighthouse-scores'
import { coreWebVitals } from '../../checks/performance/core-web-vitals'
import { pageResponseTime } from '../../checks/performance/page-response-time'
import { buildCheckRecord } from '../../runner'
import { DeviceType } from '@/lib/enums'
import type { AuditCheck, CheckContext, PostCrawlContext, PostCrawlResult } from '../../types'
import type { SiteAuditPage } from '@/lib/audit/types'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'
import type { AuditPage } from '../../types'

const PERFORMANCE_CHECK_NAMES = [lighthouseScores.name, coreWebVitals.name, pageResponseTime.name]

const PERFORMANCE_CHECKS = [lighthouseScores, coreWebVitals, pageResponseTime]

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
 * Fetch PageSpeed Insights for top pages and replace placeholder performance checks
 * with real PSI-backed results.
 *
 * Graceful no-op if PAGESPEED_API_KEY is not set.
 * Sequential PSI calls to respect rate limits (~100/day free tier).
 */
export async function runPSIPhase(context: PostCrawlContext): Promise<PostCrawlResult> {
  const { auditId, url, allPages, sampleSize, organizationId } = context

  // Skip if no API key configured
  if (!process.env.PAGESPEED_API_KEY) {
    console.log('[PSI Phase] Skipping — PAGESPEED_API_KEY not set')
    return { strategicScore: null, pagesAnalyzed: 0, checksUpserted: 0 }
  }

  const supabase = createServiceClient()

  // Filter to HTML pages only (no resources, no error pages)
  const htmlPages = allPages.filter(
    (p) => !p.is_resource && (!p.status_code || p.status_code < 400)
  )

  if (htmlPages.length === 0) {
    return { strategicScore: null, pagesAnalyzed: 0, checksUpserted: 0 }
  }

  // Select top pages by importance
  const siteAuditPages = htmlPages.map(toSiteAuditPage)
  const topPages = selectTopPages(siteAuditPages, url, sampleSize)

  let pagesAnalyzed = 0
  let checksUpserted = 0

  // Process pages sequentially to respect rate limits
  for (const pageImportance of topPages) {
    try {
      console.log(`[PSI Phase] Fetching PSI for ${pageImportance.url}`)

      const psiResult = await fetchPageSpeedInsights({
        url: pageImportance.url,
        device: DeviceType.Mobile,
      })

      await logUsage('pagespeed', 'psi_fetch', {
        organizationId: organizationId,
        feature: UsageFeature.SiteAudit,
        metadata: { auditId, pageUrl: pageImportance.url },
      })

      // Delete existing placeholder performance checks for this page
      await supabase
        .from('audit_checks')
        .delete()
        .eq('audit_id', auditId)
        .eq('page_url', pageImportance.url)
        .in('check_name', PERFORMANCE_CHECK_NAMES)

      // Extract opportunities and diagnostics for actionable details
      const opportunities = extractOpportunities(psiResult as PageSpeedResult)
        .slice(0, 5)
        .map((o) => ({ title: o.title, displayValue: o.displayValue }))
      const diagnostics = extractDiagnostics(psiResult as PageSpeedResult).map((d) => ({
        title: d.title,
        displayValue: d.displayValue,
      }))

      // Re-run performance checks with real PSI data
      const checkContext: CheckContext = {
        url: pageImportance.url,
        html: '', // Not needed for PSI-based checks
        psiData: psiResult as unknown as Record<string, unknown>,
        psiOpportunities: opportunities,
        psiDiagnostics: diagnostics,
      }

      const newChecks: AuditCheck[] = []

      for (const check of PERFORMANCE_CHECKS) {
        try {
          const result = await check.run(checkContext)
          const checkRecord = buildCheckRecord(auditId, pageImportance.url, check, result)
          // Mark as PSI-sourced in details
          if (checkRecord.details) {
            checkRecord.details.source = 'psi'
          } else {
            checkRecord.details = { source: 'psi' }
          }
          newChecks.push(checkRecord)
        } catch (error) {
          console.error(`[PSI Phase] Check ${check.name} failed for ${pageImportance.url}:`, error)
        }
      }

      if (newChecks.length > 0) {
        await supabase.from('audit_checks').insert(newChecks)
        checksUpserted += newChecks.length
      }

      pagesAnalyzed++
    } catch (error) {
      console.error(`[PSI Phase] Failed to fetch PSI for ${pageImportance.url}:`, error)
      // Continue with next page — don't let one failure block others
    }
  }

  console.log(
    `[PSI Phase] Completed: ${pagesAnalyzed}/${topPages.length} pages, ${checksUpserted} checks upserted`
  )

  return { strategicScore: null, pagesAnalyzed, checksUpserted }
}
