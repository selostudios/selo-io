import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { SiteAuditCheck } from './types'

function formatCheckForSummary(check: SiteAuditCheck): string {
  const name = check.display_name || check.check_name.replace(/_/g, ' ')
  const message = check.details?.message || ''
  return `- ${name}: ${message}`
}

function getScoreInterpretation(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs Work'
  return 'Poor'
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
  const recommendedFails = checks.filter(
    (c) => c.priority === 'recommended' && c.status === 'failed'
  )
  const warnings = checks.filter((c) => c.status === 'warning')
  const passed = checks.filter((c) => c.status === 'passed')

  const prompt = `You are writing an executive summary for a website SEO and AI-readiness audit report.

## Site Information
- URL: ${url}
- Pages Analyzed: ${pagesCrawled}
- Overall Score: ${scores.overall_score}/100 (${getScoreInterpretation(scores.overall_score)})

## Category Scores
- SEO Score: ${scores.seo_score}/100 (${getScoreInterpretation(scores.seo_score)})
- AI-Readiness Score: ${scores.ai_readiness_score}/100 (${getScoreInterpretation(scores.ai_readiness_score)})
- Technical Score: ${scores.technical_score}/100 (${getScoreInterpretation(scores.technical_score)})

## Critical Issues (${criticalFails.length} found)
${criticalFails.length > 0 ? criticalFails.slice(0, 5).map(formatCheckForSummary).join('\n') : 'None'}

## Recommended Fixes (${recommendedFails.length} found)
${recommendedFails.length > 0 ? recommendedFails.slice(0, 5).map(formatCheckForSummary).join('\n') : 'None'}

## Warnings (${warnings.length} found)
${warnings.length > 0 ? warnings.slice(0, 3).map(formatCheckForSummary).join('\n') : 'None'}

## Passed Checks
- SEO: ${passed.filter((c) => c.check_type === 'seo').length} passed
- AI-Readiness: ${passed.filter((c) => c.check_type === 'ai_readiness').length} passed
- Technical: ${passed.filter((c) => c.check_type === 'technical').length} passed

---

Write a 3-4 paragraph executive summary following these guidelines:

**Paragraph 1 - Overall Assessment:**
- Interpret the score (Poor: <50, Needs Work: 50-70, Good: 70-85, Excellent: 85+)
- Mention pages analyzed
- Highlight the site's primary strengths based on passed checks

**Paragraph 2 - Priority Issues:**
- Focus on the top 3 critical issues
- Explain WHY each issue matters (business impact, not just technical problem)
- Be specific about what's wrong

**Paragraph 3 - Quick Wins:**
- Identify 2-3 easy fixes from the recommended/warning list
- Estimate the effort (e.g., "10-15 minutes per page")
- Focus on low-effort, high-impact changes

**Paragraph 4 - Next Steps:**
- Recommend the order of fixes
- Be encouraging about potential improvement
- Mention positive findings to balance the report

**Tone:** Professional but accessible. Avoid jargon. Focus on actions, not just problems.
**Length:** 200-300 words total.
**Format:** Plain text only, no markdown.`

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt,
  })

  return text
}
