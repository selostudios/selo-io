import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { SiteAudit, SiteAuditCheck } from '@/lib/audit/types'
import type { PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit, AIOCheck } from '@/lib/aio/types'
import { CheckPriority, CheckStatus, CWVRating } from '@/lib/enums'
import { getScoreStatus } from './types'

interface SummaryInput {
  domain: string
  combinedScore: number
  seoScore: number
  pageSpeedScore: number
  aioScore: number
  siteAudit: SiteAudit
  siteChecks: SiteAuditCheck[]
  performanceResults: PerformanceAuditResult[]
  aioAudit: AIOAudit
  aioChecks: AIOCheck[]
}

/**
 * Count critical issues across all audit types
 */
function countCriticalIssues(siteChecks: SiteAuditCheck[], aioChecks: AIOCheck[]): number {
  const siteCritical = siteChecks.filter(
    (c) => c.priority === CheckPriority.Critical && c.status === CheckStatus.Failed
  ).length

  const aioCritical = aioChecks.filter(
    (c) => c.priority === CheckPriority.Critical && c.status === CheckStatus.Failed
  ).length

  return siteCritical + aioCritical
}

/**
 * Get top opportunities from all audits
 */
function getTopOpportunities(
  siteChecks: SiteAuditCheck[],
  performanceResults: PerformanceAuditResult[],
  aioChecks: AIOCheck[]
): string[] {
  const opportunities: string[] = []

  // SEO issues
  const seoIssues = siteChecks
    .filter(
      (c) =>
        (c.priority === CheckPriority.Critical || c.priority === CheckPriority.Recommended) &&
        c.status === CheckStatus.Failed
    )
    .slice(0, 3)
    .map((c) => c.display_name || c.check_name.replace(/_/g, ' '))

  opportunities.push(...seoIssues)

  // Performance issues - check for poor CWV ratings
  const poorPerformance = performanceResults.filter(
    (r) =>
      r.lcp_rating === CWVRating.Poor ||
      r.cls_rating === CWVRating.Poor ||
      r.inp_rating === CWVRating.Poor ||
      (r.performance_score !== null && r.performance_score < 50)
  )

  if (poorPerformance.length > 0) {
    opportunities.push('Page load performance')
  }

  // AIO issues
  const aioIssues = aioChecks
    .filter(
      (c) =>
        (c.priority === CheckPriority.Critical || c.priority === CheckPriority.Recommended) &&
        c.status === CheckStatus.Failed
    )
    .slice(0, 2)
    .map((c) => c.display_name || c.check_name.replace(/_/g, ' '))

  opportunities.push(...aioIssues)

  return opportunities.slice(0, 5)
}

/**
 * Get performance summary text
 */
function getPerformanceSummary(results: PerformanceAuditResult[]): string {
  if (results.length === 0) return 'No performance data available'

  const avgScore = results.reduce((sum, r) => sum + (r.performance_score ?? 0), 0) / results.length

  const mobileResults = results.filter((r) => r.device === 'mobile')
  const desktopResults = results.filter((r) => r.device === 'desktop')

  const parts: string[] = []

  if (mobileResults.length > 0) {
    const mobileAvg =
      mobileResults.reduce((sum, r) => sum + (r.performance_score ?? 0), 0) / mobileResults.length
    parts.push(`Mobile: ${Math.round(mobileAvg)}/100`)
  }

  if (desktopResults.length > 0) {
    const desktopAvg =
      desktopResults.reduce((sum, r) => sum + (r.performance_score ?? 0), 0) / desktopResults.length
    parts.push(`Desktop: ${Math.round(desktopAvg)}/100`)
  }

  return parts.join(', ') || `Average: ${Math.round(avgScore)}/100`
}

/**
 * Generate an AI-powered executive summary for a consolidated report
 */
export async function generateReportSummary(input: SummaryInput): Promise<string> {
  const {
    domain,
    combinedScore,
    seoScore,
    pageSpeedScore,
    aioScore,
    siteAudit,
    siteChecks,
    performanceResults,
    aioAudit,
    aioChecks,
  } = input

  const criticalCount = countCriticalIssues(siteChecks, aioChecks)
  const topOpportunities = getTopOpportunities(siteChecks, performanceResults, aioChecks)
  const performanceSummary = getPerformanceSummary(performanceResults)

  const seoStatus = getScoreStatus(seoScore)
  const pageSpeedStatus = getScoreStatus(pageSpeedScore)
  const aioStatus = getScoreStatus(aioScore)

  const prompt = `Write a concise executive summary for a comprehensive marketing performance report. This report combines SEO, PageSpeed, and AI Optimization audits for a customer's website.

Domain: ${domain}
Overall Score: ${combinedScore}/100

Score Breakdown:
- SEO Score: ${seoScore}/100 (${seoStatus})
- PageSpeed Score: ${pageSpeedScore}/100 (${pageSpeedStatus}) - ${performanceSummary}
- AI Optimization Score: ${aioScore}/100 (${aioStatus})

Pages Analyzed: ${siteAudit.pages_crawled} (SEO) / ${aioAudit.pages_analyzed} (AIO)
Critical Issues Found: ${criticalCount}

Top Opportunities for Improvement:
${topOpportunities.length > 0 ? topOpportunities.map((o) => `- ${o}`).join('\n') : '- No major issues found'}

Write 3 short paragraphs in plain text (NO markdown, NO bullet points, NO special formatting):

1. Opening Diagnosis: Summarize the website's overall marketing performance health in one clear sentence. Reference the combined score and which area needs the most attention (SEO, PageSpeed, or AI Optimization).

2. Business Impact: Explain what these findings mean for the business in plain English. Focus on potential losses or gains in:
   - Search visibility and organic traffic (SEO)
   - User experience and conversion rates (PageSpeed)
   - Visibility in AI-powered search and assistants (AI Optimization)

3. Priority Actions: Recommend 2-3 specific, actionable next steps based on the most impactful opportunities. If the score is high (80+), acknowledge the good work and suggest optimization opportunities.

Maximum 150 words. Professional, consultative tone. Plain text only - no asterisks, no hashes, no formatting symbols.`

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
      maxOutputTokens: 400,
    })

    return text.trim()
  } catch (error) {
    console.error('[Generate Report Summary Error]', {
      type: 'ai_generation_failed',
      domain,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })

    // Return fallback summary
    return generateFallbackReportSummary(input)
  }
}

/**
 * Generate a fallback summary when AI is unavailable
 */
export function generateFallbackReportSummary(input: SummaryInput): string {
  const {
    domain,
    combinedScore,
    seoScore,
    pageSpeedScore,
    aioScore,
    siteAudit,
    aioChecks,
    siteChecks,
  } = input

  const healthStatus =
    combinedScore >= 80
      ? 'is performing well'
      : combinedScore >= 60
        ? 'has room for improvement'
        : 'requires immediate attention'

  const criticalCount = countCriticalIssues(siteChecks, aioChecks)

  // Find the weakest area
  const scores = [
    { name: 'SEO', score: seoScore },
    { name: 'PageSpeed', score: pageSpeedScore },
    { name: 'AI Optimization', score: aioScore },
  ]
  const weakestArea = scores.reduce((min, s) => (s.score < min.score ? s : min))

  let summary = `${domain} ${healthStatus} with an overall marketing performance score of ${combinedScore}/100. `
  summary += `The analysis covers SEO (${seoScore}/100), PageSpeed (${pageSpeedScore}/100), and AI Optimization (${aioScore}/100) across ${siteAudit.pages_crawled} pages.\n\n`

  if (criticalCount > 0) {
    summary += `${criticalCount} critical issue${criticalCount !== 1 ? 's were' : ' was'} identified that may be impacting search visibility and user experience. `
    summary += `${weakestArea.name} is the area requiring the most attention with a score of ${weakestArea.score}/100.\n\n`
  } else if (combinedScore < 80) {
    summary += `While no critical issues were found, there are opportunities to improve performance, particularly in ${weakestArea.name}.\n\n`
  } else {
    summary += `The website is performing well across all areas with no critical issues identified.\n\n`
  }

  summary +=
    combinedScore >= 80
      ? 'Continue monitoring performance and consider optimization opportunities in lower-scoring areas.'
      : `Priority: Focus on improving ${weakestArea.name} to maximize overall marketing performance.`

  return summary
}

/**
 * Regenerate summary for an existing report
 */
export async function regenerateReportSummary(
  reportId: string,
  input: SummaryInput
): Promise<{ summary: string; isAIGenerated: boolean }> {
  try {
    const summary = await generateReportSummary(input)
    return { summary, isAIGenerated: true }
  } catch {
    const summary = generateFallbackReportSummary(input)
    return { summary, isAIGenerated: false }
  }
}
