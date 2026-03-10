import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type {
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  CitabilityDetails,
  CitabilitySignals,
} from '../../types'

function analyzePassage(text: string): { score: number; signals: CitabilitySignals } {
  const words = text.trim().split(/\s+/)
  const wordCount = words.length

  const hasDefinitionPattern = /\b\w+\s+(is|are|refers to|means|describes)\s/i.test(text)
  const hasStatistics = /\d+%|\d+\.\d+|\$[\d,.]+/.test(text)

  // Low pronoun density: count of "it/they/this/that/these/those" < 3
  const pronouns = text.match(/\b(it|they|this|that|these|those)\b/gi) || []
  const isSelfContained = pronouns.length < 3

  const optimalLength = wordCount >= 40 && wordCount <= 200

  const hasFactualClaims =
    /\b(according to|study|research|data shows|survey|report|analysis|findings)\b/i.test(text)

  const signals: CitabilitySignals = {
    hasDefinitionPattern,
    hasStatistics,
    isSelfContained,
    optimalLength,
    hasFactualClaims,
  }

  let score = 0
  if (hasDefinitionPattern) score++
  if (hasStatistics) score++
  if (isSelfContained) score++
  if (optimalLength) score++
  if (hasFactualClaims) score++

  return { score, signals }
}

export const citability: AuditCheckDefinition = {
  name: 'citability',
  category: CheckCategory.AIVisibility,
  priority: CheckPriority.Recommended,
  description:
    'Analyzes content passages for citability by AI models — clear, self-contained, factual statements are more likely to be cited',
  displayName: 'Low Citability',
  displayNamePassed: 'Good Citability',
  learnMoreUrl: null,
  isSiteWide: false,
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Extract text blocks from content areas
    const contentContainer = $('article').length
      ? $('article')
      : $('main').length
        ? $('main')
        : $('body')

    const passages: {
      text: string
      wordCount: number
      score: number
      signals: CitabilitySignals
    }[] = []

    contentContainer.find('p, li, blockquote').each((_, el) => {
      const text = $(el).text().trim()
      if (!text || text.split(/\s+/).length < 10) return // Skip very short passages

      const wordCount = text.split(/\s+/).length
      const { score, signals } = analyzePassage(text)
      passages.push({ text: text.slice(0, 300), wordCount, score, signals })
    })

    const citablePassages = passages.filter((p) => p.score >= 3)
    const averageScore =
      passages.length > 0 ? passages.reduce((sum, p) => sum + p.score, 0) / passages.length : 0

    const topPassages = citablePassages
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((p) => p.text)

    const details: CitabilityDetails = {
      totalPassages: passages.length,
      citablePassages: citablePassages.length,
      averageScore: Math.round(averageScore * 100) / 100,
      passageAnalysis: passages.slice(0, 10),
      topPassages,
    }

    if (citablePassages.length >= 3) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `${citablePassages.length} of ${passages.length} passages are highly citable`,
          ...(details as unknown as Record<string, unknown>),
        },
      }
    } else if (citablePassages.length >= 1) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Only ${citablePassages.length} of ${passages.length} passages are highly citable — aim for at least 3`,
          fixGuidance:
            'Add clear definitions, statistics, and self-contained factual statements to improve citability.',
          ...(details as unknown as Record<string, unknown>),
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `No highly citable passages found among ${passages.length} passages`,
          fixGuidance:
            'Include clear definitions ("X is..."), statistics, and factual claims backed by research to make content citable by AI models.',
          ...(details as unknown as Record<string, unknown>),
        },
      }
    }
  },
}
