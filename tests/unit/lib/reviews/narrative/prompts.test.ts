import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  contentHighlightsPrompt,
  defaultTemplateGaSummary,
  gaSummaryPrompt,
  header,
} from '@/lib/reviews/narrative/prompts'
import { GA_FEATURED_METRICS } from '@/lib/reviews/featured-metrics'
import type { PromptContext } from '@/lib/reviews/narrative/prompts'

const baseCtx: PromptContext = {
  organizationName: 'Test Co',
  quarter: 'Q1 2026',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  data: {},
}

describe('defaultTemplateGaSummary', () => {
  test('names every featured metric card label in the anchoring paragraph', () => {
    const template = defaultTemplateGaSummary()
    for (const metric of GA_FEATURED_METRICS) {
      expect(template).toContain(metric.label)
    }
  })

  test('includes the anchor phrase directing the model to match the cards above', () => {
    const template = defaultTemplateGaSummary()
    expect(template).toContain('match the numbers on the cards above')
  })

  test('preserves the Going well / To improve structure from the original template', () => {
    const template = defaultTemplateGaSummary()
    expect(template).toContain('Going well')
    expect(template).toContain('To improve')
  })

  test('preserves the missing-data fallback instruction', () => {
    const template = defaultTemplateGaSummary()
    expect(template).toContain('Analytics data unavailable this quarter')
  })
})

describe('defaultTemplateGaSummary dynamic featured metrics', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/reviews/featured-metrics')
    vi.resetModules()
  })

  test('reads GA_FEATURED_METRICS at call time so the list is dynamic', async () => {
    vi.resetModules()
    vi.doMock('@/lib/reviews/featured-metrics', async () => {
      const { MetricFormat } = await import('@/lib/enums')
      return {
        GA_FEATURED_METRICS: [
          { key: 'ga_sessions', label: 'Sessions', format: MetricFormat.Number },
        ],
      }
    })

    const mod = await import('@/lib/reviews/narrative/prompts')
    const template = mod.defaultTemplateGaSummary()

    expect(template).toContain('Sessions')
    expect(template).not.toContain('Active users')
    expect(template).not.toContain('New users')
  })
})

describe('gaSummaryPrompt', () => {
  test('wraps the GA template so the rendered prompt includes the anchoring content', () => {
    const prompt = gaSummaryPrompt(baseCtx)

    expect(prompt).toContain('match the numbers on the cards above')
    for (const metric of GA_FEATURED_METRICS) {
      expect(prompt).toContain(metric.label)
    }
  })
})

describe('header() with style memo', () => {
  test('omits the learned-style section entirely when memo is an empty string', () => {
    const output = header({ ...baseCtx, styleMemo: '' })
    expect(output.toLowerCase()).not.toContain('learned style')
  })

  test('omits the learned-style section entirely when memo is unset', () => {
    const output = header(baseCtx)
    expect(output.toLowerCase()).not.toContain('learned style')
  })

  test('omits the learned-style section when memo is whitespace only', () => {
    const output = header({ ...baseCtx, styleMemo: '   \n\n  ' })
    expect(output.toLowerCase()).not.toContain('learned style')
  })

  test('renders the learned-style section with the memo when present', () => {
    const memo = 'Prefer short, punchy bullets. Lead every bullet with a number.'
    const output = header({ ...baseCtx, styleMemo: memo })

    expect(output).toContain('LEARNED STYLE')
    expect(output).toContain(memo)
  })

  test('places learned-style after author notes when both are present', () => {
    const output = header({
      ...baseCtx,
      authorNotes: 'Massive paid campaign last quarter — expect softer comparables.',
      styleMemo: 'Prefer short, punchy bullets.',
    })

    expect(output).toContain('Author notes')
    expect(output).toContain('LEARNED STYLE')
    expect(output.indexOf('LEARNED STYLE')).toBeGreaterThan(output.indexOf('Author notes'))
  })
})

describe('contentHighlightsPrompt', () => {
  test('includes captions, engagement rates, and style memo in prompt', () => {
    const ctx: PromptContext = {
      organizationName: 'Acme',
      quarter: 'Q1 2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      data: {
        linkedin: {
          metrics: {},
          top_posts: [
            {
              id: 'urn:li:ugcPost:1',
              url: null,
              thumbnail_url: null,
              caption: 'Great quarter',
              posted_at: '2026-02-01',
              impressions: 1000,
              reactions: 20,
              comments: 5,
              shares: 5,
              engagement_rate: 0.03,
            },
          ],
        },
      },
      styleMemo: 'Use confident voice.',
    }
    const prompt = contentHighlightsPrompt(ctx)
    expect(prompt).toContain('What Resonated')
    expect(prompt).toContain('Great quarter')
    expect(prompt).toContain('Use confident voice.')
  })
})
