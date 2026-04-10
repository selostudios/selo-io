import { describe, test, expect } from 'vitest'
import { buildInsightPrompt } from '@/lib/ai-visibility/insights'
import { BrandSentiment } from '@/lib/enums'
import type { AnalyzedResponse } from '@/lib/ai-visibility/analyzer'

const baseContext = {
  brandName: 'Acme',
  domain: 'acme.com',
  competitors: ['BigCorp', 'SmallCo'],
  competitorDomains: { BigCorp: 'bigcorp.com', SmallCo: 'smallco.com' } as Record<string, string>,
}

describe('buildInsightPrompt', () => {
  test('generates not-mentioned prompt when brand absent', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: false,
      brand_sentiment: BrandSentiment.Neutral,
      brand_position: null,
      domain_cited: false,
      cited_urls: ['https://bigcorp.com/blog'],
      competitor_mentions: [
        { name: 'BigCorp', mentioned: true, cited: true },
        { name: 'SmallCo', mentioned: false, cited: false },
      ],
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Some AI response text', analysis, baseContext)
    expect(prompt).toContain('not mentioned')
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('acme.com')
    expect(prompt).toContain('BigCorp')
  })

  test('generates low-position prompt when mentioned late', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Neutral,
      brand_position: 3,
      domain_cited: false,
      cited_urls: [],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Response mentioning Acme third', analysis, baseContext)
    expect(prompt).toContain('position 3')
    expect(prompt).toContain('move up')
  })

  test('generates negative-sentiment prompt', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Negative,
      brand_position: 1,
      domain_cited: true,
      cited_urls: ['https://acme.com'],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Negative response about Acme', analysis, baseContext)
    expect(prompt).toContain('negative')
    expect(prompt).toContain('sentiment')
  })

  test('generates positive prompt when all good', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: true,
      cited_urls: ['https://acme.com'],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Great response about Acme', analysis, baseContext)
    expect(prompt).toContain('working well')
  })

  test('generates not-cited prompt when mentioned but not cited', () => {
    const analysis: AnalyzedResponse = {
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: false,
      cited_urls: ['https://bigcorp.com'],
      competitor_mentions: null,
      sentiment_cost_cents: 0,
    }

    const prompt = buildInsightPrompt('Response with Acme not cited', analysis, baseContext)
    expect(prompt).toContain('not cited')
    expect(prompt).toContain('cited source')
  })
})
