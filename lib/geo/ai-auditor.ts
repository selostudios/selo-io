import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import * as cheerio from 'cheerio'
import { GEOBatchAnalysisSchema } from './types'
import type { GEOPageAnalysis } from './types'
import { GEO_QUALITY_SKILL } from './skill'

const MODEL = 'claude-opus-4-20250514'

// Pricing for Claude Opus 4.5 (as of January 2025)
// $15 per 1M input tokens, $75 per 1M output tokens
const INPUT_TOKEN_COST = 15 / 1_000_000
const OUTPUT_TOKEN_COST = 75 / 1_000_000

export interface PageContent {
  url: string
  html: string
}

export interface BatchAnalysisResult {
  analyses: GEOPageAnalysis[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
}

export interface AIAuditorOptions {
  onBatchComplete?: (
    analyses: GEOPageAnalysis[],
    tokens: { promptTokens: number; completionTokens: number },
    cost: number
  ) => void
}

/**
 * Extract clean text content from HTML for AI analysis
 * Removes navigation, scripts, styles, and other non-content elements
 */
function extractContentText(html: string): string {
  const $ = cheerio.load(html)

  // Remove non-content elements
  $('nav, header, footer, aside, script, style, noscript, iframe').remove()

  // Get main content
  const mainContent = $('main, article, [role="main"], body').first()

  // Extract text with some structure preservation
  const text = mainContent
    .text()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  // Limit to ~8000 words to stay within context limits
  const words = text.split(/\s+/)
  if (words.length > 8000) {
    return words.slice(0, 8000).join(' ') + '...[content truncated]'
  }

  return text
}

/**
 * Chunk pages into batches for efficient API calls
 * Each batch processes 3-4 pages together
 */
function chunkPages(pages: PageContent[], batchSize: number = 3): PageContent[][] {
  const chunks: PageContent[][] = []

  for (let i = 0; i < pages.length; i += batchSize) {
    chunks.push(pages.slice(i, i + batchSize))
  }

  return chunks
}

/**
 * Analyze a batch of pages with Claude Opus 4.5
 * Returns validated GEO analysis for each page
 */
async function analyzeBatch(batch: PageContent[]): Promise<{
  analyses: GEOPageAnalysis[]
  inputTokens: number
  outputTokens: number
}> {
  // Extract content from each page
  const pageContents = batch.map((page) => ({
    url: page.url,
    content: extractContentText(page.html),
  }))

  const prompt = `${GEO_QUALITY_SKILL}

## Pages to Analyze

${pageContents.map((p, i) => `
### Page ${i + 1}: ${p.url}

${p.content.slice(0, 6000)}
${p.content.length > 6000 ? '...[truncated for brevity]' : ''}
`).join('\n\n')}

Analyze each page and provide structured output with scores, findings, and recommendations.

CRITICAL: Your response must be a JSON object with this exact structure:
{
  "analyses": [ array of page analysis objects ],
  "batchMetadata": { optional metadata object }
}

Do NOT return just an array. You MUST wrap the analyses array in an object with an "analyses" key.
Do NOT wrap the response in markdown code blocks.
Return ONLY the JSON object, no explanation text before or after.`

  try {
    // Use generateText with JSON mode for better control over parsing
    const result = await generateText({
      model: anthropic(MODEL),
      prompt,
      temperature: 0.3, // Lower temperature for more consistent scoring
    })

    console.log(
      `[AI Auditor] Analyzed ${batch.length} pages, tokens: ${result.usage.inputTokens ?? 0}/${result.usage.outputTokens ?? 0}`
    )

    // Parse and validate the JSON response
    let parsedResponse: unknown
    try {
      // Clean up potential markdown code blocks
      let cleanedText = result.text.trim()
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      parsedResponse = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('[AI Auditor] Failed to parse JSON response:', result.text.slice(0, 500))
      throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    // Validate with Zod schema
    const validated = GEOBatchAnalysisSchema.parse(parsedResponse)

    return {
      analyses: validated.analyses,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    }
  } catch (error) {
    console.error('[AI Auditor] Batch analysis failed:', error)
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error('[AI Auditor] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      })
    }
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Run AI-powered GEO analysis on multiple pages
 * Processes pages in batches and streams results via callback
 */
export async function runAIAnalysis(
  pages: PageContent[],
  options: AIAuditorOptions = {}
): Promise<BatchAnalysisResult> {
  const { onBatchComplete } = options

  if (pages.length === 0) {
    return {
      analyses: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    }
  }

  console.log(`[AI Auditor] Starting analysis of ${pages.length} pages`)

  const allAnalyses: GEOPageAnalysis[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Process in batches of 3-4 pages
  const batches = chunkPages(pages, 3)

  for (const batch of batches) {
    const { analyses, inputTokens, outputTokens } = await analyzeBatch(batch)

    // Accumulate results
    allAnalyses.push(...analyses)
    totalInputTokens += inputTokens
    totalOutputTokens += outputTokens

    // Calculate cost for this batch
    const batchCost = inputTokens * INPUT_TOKEN_COST + outputTokens * OUTPUT_TOKEN_COST

    // Stream results via callback
    if (onBatchComplete) {
      await onBatchComplete(
        analyses,
        { promptTokens: inputTokens, completionTokens: outputTokens },
        batchCost
      )
    }

    // Small delay between batches to avoid rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  const totalCost = totalInputTokens * INPUT_TOKEN_COST + totalOutputTokens * OUTPUT_TOKEN_COST

  console.log(
    `[AI Auditor] Completed analysis: ${allAnalyses.length} pages, ${totalInputTokens}/${totalOutputTokens} tokens, $${totalCost.toFixed(4)}`
  )

  return {
    analyses: allAnalyses,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
  }
}

/**
 * Calculate strategic score from AI analyses
 * Weighted average of the 5 quality dimensions
 */
export function calculateStrategicScore(analyses: GEOPageAnalysis[]): number {
  if (analyses.length === 0) return 0

  // Weights for each dimension (sum to 1.0)
  const weights = {
    dataQuality: 0.25,
    expertCredibility: 0.20,
    comprehensiveness: 0.20,
    citability: 0.25,
    authority: 0.10,
  }

  // Calculate weighted average across all pages
  const totalScore = analyses.reduce((sum, analysis) => {
    const pageScore =
      analysis.scores.dataQuality * weights.dataQuality +
      analysis.scores.expertCredibility * weights.expertCredibility +
      analysis.scores.comprehensiveness * weights.comprehensiveness +
      analysis.scores.citability * weights.citability +
      analysis.scores.authority * weights.authority

    return sum + pageScore
  }, 0)

  return Math.round(totalScore / analyses.length)
}
