import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runAIAnalysis, calculateStrategicScore } from '@/lib/geo/ai-auditor'
import type { PageContent } from '@/lib/geo/ai-auditor'
import {
  mockBatchAnalysis,
  mockGEOPageAnalysis,
  mockGEOPageAnalysisThin,
  createMockGenerateTextResponse,
} from '../../../fixtures/geo-ai-responses'
import * as ai from 'ai'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn((model: string) => model),
}))

describe('AI Auditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('runAIAnalysis', () => {
    it('should analyze pages and return results', async () => {
      const mockResponse = createMockGenerateTextResponse(mockBatchAnalysis)
      vi.mocked(ai.generateText).mockResolvedValue(mockResponse as never)

      const pages: PageContent[] = [
        {
          url: 'https://example.com/guide',
          html: '<html><body><main><h1>SEO Guide</h1><p>Content here...</p></main></body></html>',
        },
        {
          url: 'https://example.com/contact',
          html: '<html><body><main><h1>Contact</h1><p>Email us</p></main></body></html>',
        },
      ]

      const result = await runAIAnalysis(pages)

      expect(result.analyses).toHaveLength(2)
      expect(result.totalInputTokens).toBe(5234)
      expect(result.totalOutputTokens).toBe(1842)
      expect(result.totalCost).toBeGreaterThan(0)
    })

    it('should call onBatchComplete callback', async () => {
      const mockResponse = createMockGenerateTextResponse(mockBatchAnalysis)
      vi.mocked(ai.generateText).mockResolvedValue(mockResponse as never)

      const onBatchComplete = vi.fn()
      const pages: PageContent[] = [
        {
          url: 'https://example.com/page',
          html: '<html><body><main><p>Content</p></main></body></html>',
        },
      ]

      await runAIAnalysis(pages, { onBatchComplete })

      expect(onBatchComplete).toHaveBeenCalled()
      expect(onBatchComplete).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
        }),
        expect.any(Number)
      )
    })

    it('should handle empty page list', async () => {
      const result = await runAIAnalysis([])

      expect(result.analyses).toHaveLength(0)
      expect(result.totalInputTokens).toBe(0)
      expect(result.totalOutputTokens).toBe(0)
      expect(result.totalCost).toBe(0)
      expect(ai.generateText).not.toHaveBeenCalled()
    })

    it('should chunk pages into batches of 3', async () => {
      const mockResponse = createMockGenerateTextResponse({
        ...mockBatchAnalysis,
        analyses: [mockGEOPageAnalysis, mockGEOPageAnalysis, mockGEOPageAnalysis],
      })
      vi.mocked(ai.generateText).mockResolvedValue(mockResponse as never)

      const pages: PageContent[] = Array.from({ length: 7 }, (_, i) => ({
        url: `https://example.com/page-${i}`,
        html: '<html><body><main><p>Content</p></main></body></html>',
      }))

      await runAIAnalysis(pages)

      // Should make 3 API calls: [3 pages], [3 pages], [1 page]
      expect(ai.generateText).toHaveBeenCalledTimes(3)
    })

    it('should handle API errors gracefully', async () => {
      vi.mocked(ai.generateText).mockRejectedValue(new Error('API rate limit exceeded'))

      const pages: PageContent[] = [
        {
          url: 'https://example.com/page',
          html: '<html><body><main><p>Content</p></main></body></html>',
        },
      ]

      await expect(runAIAnalysis(pages)).rejects.toThrow('AI analysis failed')
    })

    it('should calculate cost correctly', async () => {
      const mockResponse = createMockGenerateTextResponse(mockBatchAnalysis)
      vi.mocked(ai.generateText).mockResolvedValue(mockResponse as never)

      const pages: PageContent[] = [
        {
          url: 'https://example.com/page',
          html: '<html><body><main><p>Content</p></main></body></html>',
        },
      ]

      const result = await runAIAnalysis(pages)

      // Cost = (5234 * 0.000015) + (1842 * 0.000075)
      const expectedCost = 5234 * (15 / 1_000_000) + 1842 * (75 / 1_000_000)
      expect(result.totalCost).toBeCloseTo(expectedCost, 6)
    })
  })

  describe('calculateStrategicScore', () => {
    it('should calculate weighted average score', () => {
      const analyses = [mockGEOPageAnalysis, mockGEOPageAnalysisThin]

      const score = calculateStrategicScore(analyses)

      // Weighted calculation based on the 5 dimensions
      // Page 1: (75*0.25 + 82*0.20 + 78*0.20 + 85*0.25 + 80*0.10) = 80
      // Page 2: (20*0.25 + 15*0.20 + 30*0.20 + 25*0.25 + 40*0.10) = 24
      // Average: (80 + 24) / 2 = 52
      expect(score).toBe(52)
    })

    it('should handle single page', () => {
      const score = calculateStrategicScore([mockGEOPageAnalysis])

      // Should match the page's overall score closely
      expect(score).toBeCloseTo(80, 0)
    })

    it('should return 0 for empty analyses', () => {
      const score = calculateStrategicScore([])

      expect(score).toBe(0)
    })

    it('should use correct weights', () => {
      const perfectPage = {
        ...mockGEOPageAnalysis,
        scores: {
          dataQuality: 100,
          expertCredibility: 100,
          comprehensiveness: 100,
          citability: 100,
          authority: 100,
          overall: 100,
        },
      }

      const score = calculateStrategicScore([perfectPage])

      // All 100s with any weights should equal 100
      expect(score).toBe(100)
    })
  })
})
