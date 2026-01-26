import * as cheerio from 'cheerio'
import type { GEOCheckDefinition, GEOCheckContext, CheckResult } from '@/lib/geo/types'

export const readability: GEOCheckDefinition = {
  name: 'readability',
  category: 'content_quality',
  priority: 'recommended',
  description: 'Clear, readable content is easier for AI engines to parse and cite',
  displayName: 'Poor Readability',
  displayNamePassed: 'Good Readability',
  learnMoreUrl: 'https://web.dev/articles/content-readability',
  isSiteWide: false,

  async run(context: GEOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Get main content text
    $('nav, header, footer, aside, script, style, noscript').remove()
    const mainText = $('main, article, [role="main"], body').first().text()

    const sentences = mainText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = mainText.trim().split(/\s+/).filter(w => w.length > 0)

    if (sentences.length === 0 || words.length === 0) {
      return {
        status: 'failed',
        details: { message: 'No readable content found' },
      }
    }

    // Calculate average sentence length
    const avgSentenceLength = words.length / sentences.length

    // Calculate average word length
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length

    // Simplified Flesch Reading Ease approximation
    // Score = 206.835 - 1.015(words/sentences) - 84.6(syllables/words)
    // We'll approximate syllables by counting vowel groups
    const syllables = words.reduce((sum, word) => {
      const vowelGroups = word.toLowerCase().match(/[aeiouy]+/g)
      return sum + (vowelGroups ? vowelGroups.length : 1)
    }, 0)
    const avgSyllablesPerWord = syllables / words.length

    const fleschScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord

    // Readability categories:
    // 90-100: Very Easy (5th grade)
    // 80-90: Easy (6th grade)
    // 70-80: Fairly Easy (7th grade)
    // 60-70: Standard (8th-9th grade) - IDEAL for web content
    // 50-60: Fairly Difficult (10th-12th grade)
    // 30-50: Difficult (college level)
    // 0-30: Very Difficult

    const details = {
      fleschScore: Math.round(fleschScore),
      avgSentenceLength: Math.round(avgSentenceLength),
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      totalSentences: sentences.length,
      totalWords: words.length,
    }

    if (fleschScore >= 60) {
      return {
        status: 'passed',
        details: {
          message: `Good readability (Flesch score: ${Math.round(fleschScore)}, avg sentence length: ${Math.round(avgSentenceLength)} words)`,
          ...details,
        },
      }
    } else if (fleschScore >= 40) {
      return {
        status: 'warning',
        details: {
          message: `Moderate readability (Flesch score: ${Math.round(fleschScore)}). Consider simplifying sentence structure.`,
          ...details,
          fixGuidance: 'Break up long sentences (keep under 20 words) and use simpler vocabulary where possible.',
        },
      }
    } else {
      return {
        status: 'failed',
        details: {
          message: `Poor readability (Flesch score: ${Math.round(fleschScore)}). Content is too complex for optimal AI extraction.`,
          ...details,
          fixGuidance: 'Significantly simplify language: use shorter sentences (12-15 words), simpler words, and active voice.',
        },
      }
    }
  },
}
