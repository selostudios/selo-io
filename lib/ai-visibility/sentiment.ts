import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { BrandSentiment, AIPlatform } from '@/lib/enums'
import { estimateCostCents } from './platforms/types'

const MODEL = 'claude-haiku-4-5-20251001'

interface SentimentResult {
  sentiment: BrandSentiment
  inputTokens: number
  outputTokens: number
  costCents: number
}

interface BatchSentimentResult {
  sentiments: BrandSentiment[]
  inputTokens: number
  outputTokens: number
  costCents: number
}

function parseSentiment(text: string): BrandSentiment {
  const lower = text.trim().toLowerCase()
  if (lower === 'positive') return BrandSentiment.Positive
  if (lower === 'negative') return BrandSentiment.Negative
  if (lower === 'neutral') return BrandSentiment.Neutral
  return BrandSentiment.Neutral
}

/**
 * Classify sentiment of a single brand mention.
 * Falls back to neutral on any error.
 */
export async function analyzeSentiment(
  responseText: string,
  brandName: string
): Promise<SentimentResult> {
  try {
    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      prompt: `Classify the sentiment toward "${brandName}" in the following text. Reply with exactly one word: positive, neutral, or negative.\n\nText: ${responseText}`,
      maxTokens: 10,
    })

    const inputTokens = usage?.inputTokens ?? 0
    const outputTokens = usage?.outputTokens ?? 0

    return {
      sentiment: parseSentiment(text),
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(AIPlatform.Claude, inputTokens, outputTokens),
    }
  } catch {
    return { sentiment: BrandSentiment.Neutral, inputTokens: 0, outputTokens: 0, costCents: 0 }
  }
}

/**
 * Classify sentiment for multiple responses in a single API call.
 * More cost-effective than individual calls.
 * Falls back to neutral for all items on error.
 */
export async function analyzeSentimentBatch(
  items: { text: string; brandName: string }[]
): Promise<BatchSentimentResult> {
  if (items.length === 0) {
    return { sentiments: [], inputTokens: 0, outputTokens: 0, costCents: 0 }
  }

  try {
    const itemList = items
      .map((item, i) => `[${i}] Brand: "${item.brandName}"\nText: ${item.text}`)
      .join('\n\n')

    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      prompt: `Classify the sentiment toward each brand in the texts below. Return a JSON array with objects containing "index" (number) and "sentiment" (one of: "positive", "neutral", "negative").\n\n${itemList}`,
      maxTokens: items.length * 30,
    })

    const inputTokens = usage?.inputTokens ?? 0
    const outputTokens = usage?.outputTokens ?? 0

    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    const sentiments = items.map((_, i) => {
      const entry = parsed.find((p: { index: number; sentiment: string }) => p.index === i)
      return entry ? parseSentiment(entry.sentiment) : BrandSentiment.Neutral
    })

    return {
      sentiments,
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(AIPlatform.Claude, inputTokens, outputTokens),
    }
  } catch {
    return {
      sentiments: items.map(() => BrandSentiment.Neutral),
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
    }
  }
}
