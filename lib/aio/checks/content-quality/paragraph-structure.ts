import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const paragraphStructure: AIOCheckDefinition = {
  name: 'paragraph_structure',
  category: AIOCheckCategory.ContentQuality,
  priority: CheckPriority.Recommended,
  description: 'Scannable paragraphs improve content extraction by AI engines',
  displayName: 'Poor Paragraph Structure',
  displayNamePassed: 'Scannable Paragraphs',
  learnMoreUrl: 'https://web.dev/articles/content-structure',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Get paragraphs from main content
    $('nav, header, footer, aside, script, style, noscript').remove()
    const paragraphs = $('p')

    if (paragraphs.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: 'No paragraph elements found. Content should be broken into paragraphs.',
          fixGuidance: 'Structure content with <p> tags instead of line breaks or divs.',
        },
      }
    }

    // Analyze paragraph lengths
    const paragraphLengths = paragraphs
      .map((_, el) => $(el).text().trim().split(/\s+/).length)
      .get()
      .filter(len => len > 0)

    const avgParagraphLength = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
    const longParagraphs = paragraphLengths.filter(len => len > 150).length
    const shortParagraphs = paragraphLengths.filter(len => len < 30 && len > 0).length

    const issues = []
    const strengths = []

    // Check average paragraph length (ideal: 40-100 words)
    if (avgParagraphLength > 120) {
      issues.push('paragraphs too long on average')
    } else if (avgParagraphLength >= 40 && avgParagraphLength <= 100) {
      strengths.push('ideal average paragraph length')
    }

    // Check for wall-of-text paragraphs
    if (longParagraphs > paragraphLengths.length * 0.2) {
      issues.push(`${longParagraphs} very long paragraphs (150+ words)`)
    }

    // Check paragraph variety
    const hasVariety = shortParagraphs > 0 && paragraphLengths.some(len => len >= 50)
    if (hasVariety) {
      strengths.push('good paragraph variety')
    }

    const details = {
      totalParagraphs: paragraphs.length,
      avgParagraphLength: Math.round(avgParagraphLength),
      longParagraphs,
      shortParagraphs,
    }

    if (issues.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `Scannable paragraphs: ${strengths.join(', ')} (${paragraphs.length} paragraphs, avg ${Math.round(avgParagraphLength)} words)`,
          ...details,
        },
      }
    } else if (issues.length === 1) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Paragraph structure could be improved: ${issues.join('; ')}`,
          ...details,
          fixGuidance: 'Break long paragraphs into 3-5 sentence chunks (40-80 words) for better scannability.',
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Poor paragraph structure: ${issues.join('; ')}`,
          ...details,
          fixGuidance: 'Restructure content into shorter, focused paragraphs (40-80 words each) with clear topic sentences.',
        },
      }
    }
  },
}
