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

  const prompt = `Analyze this website audit and write a brief executive summary for the site owner.

Site: ${url}
Score: ${scores.overall_score}/100
Pages analyzed: ${pagesCrawled}

Critical issues (${criticalFails.length}):
${criticalList}

Warnings (${warnings.length}):
${warningList}

Passed (${passed.length} checks)

Write 2-3 short paragraphs that:
- Assess overall site health in plain language
- Explain the business impact of the top 2-3 issues (e.g., "missing meta descriptions means search engines can't properly display your pages")
- Identify one quick win they could address today

Tone: Direct, helpful, professional. Write for someone who isn't technical but makes business decisions.

Maximum 120 words.`

  const { text } = await generateText({
    model: anthropic('claude-opus-4-5-20250514'),
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
        ? 'needs some attention'
        : 'requires immediate attention'

  const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  let summary = `Your website ${domain} ${healthStatus} with an overall score of ${scores.overall_score}/100. `
  summary += `We analyzed ${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} and found `
  summary += `${criticalFails.length} critical issue${criticalFails.length !== 1 ? 's' : ''}, `
  summary += `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}, `
  summary += `and ${passed.length} check${passed.length !== 1 ? 's' : ''} passed.`

  if (criticalFails.length > 0) {
    summary += ` We recommend addressing the critical issues first to improve your site's performance and visibility.`
  } else if (warnings.length > 0) {
    summary += ` Consider addressing the recommended improvements to further optimize your site.`
  } else {
    summary += ` Your site is performing well across all our checks.`
  }

  return summary
}
