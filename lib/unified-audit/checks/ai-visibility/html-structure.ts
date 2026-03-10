import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const htmlStructure: AuditCheckDefinition = {
  name: 'html_structure',
  category: CheckCategory.AIVisibility,
  priority: CheckPriority.Recommended,
  description: 'Clean, semantic HTML helps AI engines parse and understand your content',
  displayName: 'Poor HTML Structure',
  displayNamePassed: 'Clean HTML Structure',
  learnMoreUrl: 'https://web.dev/articles/semantic-html',
  isSiteWide: false,
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const issues: string[] = []

    // Check for semantic HTML5 elements
    const semanticElements = ['article', 'section', 'nav', 'aside', 'header', 'footer', 'main']
    const foundSemantic = semanticElements.filter((tag) => $(tag).length > 0)

    if (foundSemantic.length === 0) {
      issues.push('No semantic HTML5 elements found (article, section, header, etc.)')
    }

    // Check for proper heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6')
    if (headings.length === 0) {
      issues.push('No headings found')
    }

    // Check for excessive divs (potential div soup)
    const divs = $('div').length
    const allElements = $('*').length
    const divRatio = divs / allElements

    if (divRatio > 0.4) {
      issues.push(`High div ratio (${(divRatio * 100).toFixed(1)}%) suggests non-semantic markup`)
    }

    // Check for proper document structure
    if ($('html').length === 0 || $('head').length === 0 || $('body').length === 0) {
      issues.push('Missing basic HTML structure (html, head, or body tags)')
    }

    if (issues.length === 0) {
      return {
        status: CheckStatus.Passed,
      }
    } else if (issues.length <= 2) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `HTML structure could be improved: ${issues.join('; ')}`,
          issues,
          fixGuidance:
            'Use semantic HTML5 elements (article, section, header) instead of generic divs where appropriate.',
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Poor HTML structure: ${issues.join('; ')}`,
          issues,
          fixGuidance: 'Refactor markup to use semantic HTML5 elements and reduce div soup.',
        },
      }
    }
  },
}
