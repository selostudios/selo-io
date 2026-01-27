import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { SiteAuditCheck } from './types'

function formatCheckName(check: SiteAuditCheck): string {
  return check.display_name || check.check_name.replace(/_/g, ' ')
}

export async function generateExecutiveSummary(
  url: string,
  pagesCrawled: number,
  scores: {
    overall_score: number
    seo_score: number
    ai_readiness_score: number
    technical_score: number
  },
  checks: SiteAuditCheck[]
): Promise<string> {
  const criticalFails = checks.filter((c) => c.priority === 'critical' && c.status === 'failed')
  const warnings = checks.filter(
    (c) => c.status === 'warning' || (c.priority === 'recommended' && c.status === 'failed')
  )
  const passed = checks.filter((c) => c.status === 'passed')

  const criticalList =
    criticalFails.length > 0
      ? criticalFails
          .slice(0, 5)
          .map((c) => `- ${formatCheckName(c)}`)
          .join('\n')
      : '- None'

  const warningList =
    warnings.length > 0
      ? warnings
          .slice(0, 5)
          .map((c) => `- ${formatCheckName(c)}`)
          .join('\n')
      : '- None'

  const prompt = `Write a concise executive summary for this website audit. The reader is a Selo employee reviewing this audit for a customer.

Site: ${url}
Overall Score: ${scores.overall_score}/100 (SEO: ${scores.seo_score}, AI Readiness: ${scores.ai_readiness_score}, Technical: ${scores.technical_score})
Pages analyzed: ${pagesCrawled}
Critical issues: ${criticalFails.length}
Warnings: ${warnings.length}
Passed: ${passed.length} checks

Top issues:
${criticalFails.length > 0 ? criticalList : warningList}

Write 2-3 short paragraphs in plain text (NO markdown, NO bullet points, NO special formatting):

1. Opening: Diagnose the site's overall health in one clear sentence. Be specific about what's working and what's not.

2. Impact: Explain the business consequences of the main issues in plain English. Focus on what the customer is losing (traffic, conversions, visibility) rather than listing technical details.

3. Next Steps: Provide 1-2 clear, actionable recommendations. If the score is high (80+), keep this brief and congratulatory.

Maximum 100 words. Direct, professional tone. Plain text only - no asterisks, no hashes, no formatting symbols.`

  const { text } = await generateText({
    model: anthropic('claude-opus-4-5-20251101'),
    prompt,
    maxOutputTokens: 300,
  })

  return text.trim()
}

/**
 * Generate a fallback summary when AI is unavailable.
 */
export function generateFallbackSummary(
  url: string,
  pagesCrawled: number,
  scores: { overall_score: number },
  checks: SiteAuditCheck[]
): string {
  const criticalFails = checks.filter((c) => c.priority === 'critical' && c.status === 'failed')
  const warnings = checks.filter((c) => c.status === 'warning')
  const passed = checks.filter((c) => c.status === 'passed')

  const healthStatus =
    scores.overall_score >= 80
      ? 'is in good health'
      : scores.overall_score >= 60
        ? 'needs attention'
        : 'requires immediate attention'

  const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  let summary = `The customer's website ${domain} ${healthStatus} with an overall score of ${scores.overall_score}/100. `
  summary += `Analysis of ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} found `
  summary += `${criticalFails.length} critical issue${criticalFails.length !== 1 ? 's' : ''}, `
  summary += `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}, `
  summary += `and ${passed.length} passing check${passed.length !== 1 ? 's' : ''}.\n\n`

  if (criticalFails.length > 0) {
    summary += `Priority: Address critical issues first to improve search visibility and site performance.`
  } else if (warnings.length > 0) {
    summary += `Priority: Implement recommended improvements to optimize search performance.`
  } else {
    summary += `The site is performing well across all checks.`
  }

  return summary
}
