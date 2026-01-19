import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { SiteAuditCheck } from './types'

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

  const prompt = `You are writing an executive summary for a website audit report.

Site: ${url}
Pages crawled: ${pagesCrawled}
Overall Score: ${scores.overall_score}/100

Results:
- SEO: ${scores.seo_score}/100 - ${criticalFails.filter((c) => c.check_type === 'seo').length} critical issues
- AI-Readiness: ${scores.ai_readiness_score}/100 - ${criticalFails.filter((c) => c.check_type === 'ai_readiness').length} critical issues
- Technical: ${scores.technical_score}/100 - ${criticalFails.filter((c) => c.check_type === 'technical').length} critical issues

Top critical issues: ${
    criticalFails
      .slice(0, 5)
      .map((c) => c.check_name.replace(/_/g, ' '))
      .join(', ') || 'None'
  }

Write a 2-3 paragraph executive summary that:
1. Summarizes the overall health of the site
2. Highlights the most impactful issues to fix
3. Ends with an encouraging next step

Keep it non-technical and suitable for a business owner. Do not use markdown formatting.`

  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    prompt,
  })

  return text
}
