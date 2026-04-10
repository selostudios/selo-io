import { generateText } from 'ai'
import { getAnthropicProvider } from '@/lib/ai/provider'
import type { SiteAudit, SiteAuditCheck } from '@/lib/audit/types'
import type { PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit, AIOCheck } from '@/lib/aio/types'
import { CheckPriority, CheckStatus, CWVRating, UsageFeature } from '@/lib/enums'
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
  organizationId?: string | null
  reportId?: string
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
    aioChecks,
  } = input

  const criticalCount = countCriticalIssues(siteChecks, aioChecks)
  const topOpportunities = getTopOpportunities(siteChecks, performanceResults, aioChecks)
  const performanceSummary = getPerformanceSummary(performanceResults)

  const seoStatus = getScoreStatus(seoScore)
  const pageSpeedStatus = getScoreStatus(pageSpeedScore)
  const aioStatus = getScoreStatus(aioScore)

  const prompt = `You are writing an executive summary for a client-facing marketing performance report. You are speaking directly to the business owner or marketing lead — someone who cares about results, not technical jargon.

Domain: ${domain}
Overall Score: ${combinedScore}/100

Score Breakdown:
- SEO Score: ${seoScore}/100 (${seoStatus})
- PageSpeed Score: ${pageSpeedScore}/100 (${pageSpeedStatus}) - ${performanceSummary}
- AI Optimization Score: ${aioScore}/100 (${aioStatus})

Pages Analyzed: ${siteAudit.pages_crawled} (SEO)
Critical Issues Found: ${criticalCount}

Top Opportunities for Improvement:
${topOpportunities.length > 0 ? topOpportunities.map((o) => `- ${o}`).join('\n') : '- No major issues found'}

Write 3 short paragraphs in plain text (NO markdown, NO bullet points, NO special formatting). Address the reader as "you" and "your" — this is a conversation, not a lab report.

1. Where you stand: Lead with what's working well before addressing gaps. Be specific — don't just recite scores, explain what they mean for the business. For example, a low page speed score means potential customers are leaving before seeing your content.

2. What's at stake: Translate the findings into business outcomes the reader cares about — lost leads, missed revenue, competitors showing up ahead of them in search. Make it tangible and relatable, not abstract.

3. What to do next: Recommend 2-3 clear next steps, framed as opportunities rather than problems. Use language like "By improving X, you could see Y" rather than "Fix X". If scores are high (80+), reinforce confidence and suggest where to push further.

Maximum 150 words. Warm, confident, consultative tone — like a trusted advisor, not a scorecard. Plain text only — no asterisks, no hashes, no formatting symbols.`

  try {
    const anthropic = await getAnthropicProvider()
    const { text, usage } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
      maxOutputTokens: 400,
    })

    const { logUsage } = await import('@/lib/app-settings/usage')
    await logUsage('anthropic', 'summary_generation', {
      organizationId: input.organizationId,
      feature: UsageFeature.ClientReports,
      tokensInput: usage?.inputTokens,
      tokensOutput: usage?.outputTokens,
      metadata: { reportId: input.reportId, domain },
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
  const { combinedScore, seoScore, pageSpeedScore, aioScore, siteAudit, aioChecks, siteChecks } =
    input

  const criticalCount = countCriticalIssues(siteChecks, aioChecks)

  // Find the weakest and strongest areas
  const scores = [
    { name: 'SEO', label: 'search visibility', score: seoScore },
    { name: 'PageSpeed', label: 'site speed', score: pageSpeedScore },
    { name: 'AI Optimization', label: 'AI search readiness', score: aioScore },
  ]
  const weakestArea = scores.reduce((min, s) => (s.score < min.score ? s : min))
  const strongestArea = scores.reduce((max, s) => (s.score > max.score ? s : max))

  let summary = ''

  if (combinedScore >= 80) {
    summary += `Your site is in a strong position with an overall score of ${combinedScore}/100. `
    summary += `Your ${strongestArea.label} is particularly solid at ${strongestArea.score}/100, which means you're already ahead of most competitors in this area.\n\n`
  } else if (combinedScore >= 60) {
    summary += `Your site has a solid foundation to build on, scoring ${combinedScore}/100 overall. `
    summary += `Your ${strongestArea.label} is a real strength at ${strongestArea.score}/100, and there are clear opportunities to bring other areas up to match.\n\n`
  } else {
    summary += `We've completed a thorough analysis of your site across ${siteAudit.pages_crawled} pages, and your overall score is ${combinedScore}/100. `
    summary += `While there's meaningful work to do, the good news is that the biggest improvements are often the most straightforward to implement.\n\n`
  }

  if (criticalCount > 0) {
    summary += `We found ${criticalCount} critical issue${criticalCount !== 1 ? 's' : ''} that could be costing you visitors and potential customers. `
    summary += `Your ${weakestArea.label} score of ${weakestArea.score}/100 suggests you may be losing ground to competitors who have invested in this area.\n\n`
  } else if (combinedScore < 80) {
    summary += `There are no critical issues holding you back, but improving your ${weakestArea.label} (currently ${weakestArea.score}/100) could make a noticeable difference in how many people find and engage with your site.\n\n`
  } else {
    summary += `No critical issues were found across any area, which is a great position to be in.\n\n`
  }

  summary +=
    combinedScore >= 80
      ? `To keep your competitive edge, consider fine-tuning your ${weakestArea.label} — even small gains at this level can translate to meaningful results.`
      : `By focusing on ${weakestArea.label} first, you could see the biggest return on investment. We've outlined specific steps in the recommendations section to help you get started.`

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
