import { createClient } from '@/lib/supabase/server'
import { crawlSite } from './crawler'
import { allChecks } from './checks'
import { fetchPage } from './fetcher'
import { generateExecutiveSummary } from './summary'
import type { SiteAuditCheck, CheckContext } from './types'

export async function runAudit(auditId: string, url: string): Promise<void> {
  const supabase = await createClient()

  // Update status to crawling
  await supabase
    .from('site_audits')
    .update({ status: 'crawling', started_at: new Date().toISOString() })
    .eq('id', auditId)

  try {
    // Crawl the site
    const { pages } = await crawlSite(url, auditId, {
      maxPages: 200,
      onPageCrawled: async (page) => {
        // Save page to database
        await supabase.from('site_audit_pages').insert(page)

        // Update pages_crawled count
        await supabase
          .from('site_audits')
          .update({ pages_crawled: pages.length + 1 })
          .eq('id', auditId)
      },
    })

    // Update status to checking
    await supabase
      .from('site_audits')
      .update({ status: 'checking' as const })
      .eq('id', auditId)

    // Run checks on each page
    const allCheckResults: SiteAuditCheck[] = []

    for (const page of pages) {
      const { html } = await fetchPage(page.url)

      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title,
        statusCode: page.status_code ?? 200,
        allPages: pages,
      }

      for (const check of allChecks) {
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
          }

          allCheckResults.push(checkResult)
          await supabase.from('site_audit_checks').insert(checkResult)
        } catch (error) {
          console.error(`[Audit] Check ${check.name} failed:`, error)
        }
      }
    }

    // Calculate scores
    const scores = calculateScores(allCheckResults)

    // Generate executive summary
    let executive_summary: string | null = null
    try {
      executive_summary = await generateExecutiveSummary(url, pages.length, scores, allCheckResults)
    } catch (error) {
      console.error('[Audit] Failed to generate executive summary:', error)
    }

    // Update audit with scores and summary
    await supabase
      .from('site_audits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        executive_summary,
        ...scores,
      })
      .eq('id', auditId)
  } catch (error) {
    console.error('[Audit] Runner failed:', error)
    await supabase
      .from('site_audits')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}

function calculateScores(checks: SiteAuditCheck[]) {
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

  return { overall_score, seo_score, ai_readiness_score, technical_score }
}
