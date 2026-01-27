import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runAIOChecks, getCategoryScores } from '@/lib/aio/runner'
import type { AIOCheck } from '@/lib/aio/types'
import * as crawler from '@/lib/audit/crawler'

// Mock the crawler module
vi.mock('@/lib/audit/crawler', () => ({
  crawlSite: vi.fn(),
}))

describe('GEO Runner', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(crawler.crawlSite).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('runAIOChecks', () => {
    it('should run all checks and calculate technical score', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Page</title>
            <meta name="viewport" content="width=device-width">
            <script type="application/ld+json">
              {"@type": "Article"}
            </script>
          </head>
          <body>
            <main>
              <h1>Test Article</h1>
              ${'<p>Lorem ipsum dolor sit amet. '.repeat(100)}</p>
            </main>
          </body>
        </html>
      `

      // Mock robots.txt check
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'User-agent: *\nAllow: /',
      })
      vi.stubGlobal('fetch', mockFetch)

      // Mock crawler to call onPageCrawled callback
      vi.mocked(crawler.crawlSite).mockImplementation(async (_url, _auditId, options) => {
        if (options.onPageCrawled) {
          await options.onPageCrawled(
            {
              id: 'page-1',
              audit_id: 'test-audit',
              url: 'https://example.com',
              title: 'Test Page',
              meta_description: null,
              status_code: 200,
              last_modified: null,
              crawled_at: new Date().toISOString(),
              is_resource: false,
              resource_type: null,
            },
            mockHtml
          )
        }

        return {
          pages: [],
          errors: [],
          stopped: false,
        }
      })

      const result = await runAIOChecks({
        auditId: 'test-audit',
        url: 'https://example.com',
        sampleSize: 1,
      })

      // Should have results for all checks
      expect(result.checks.length).toBeGreaterThan(0)

      // Should have a technical score
      expect(result.technicalScore).toBeGreaterThanOrEqual(0)
      expect(result.technicalScore).toBeLessThanOrEqual(100)

      // Should have correct structure
      expect(result.aiAnalyses).toEqual([])
      expect(result.strategicScore).toBeNull()
      expect(result.overallScore).toBe(result.technicalScore)
    })

    it('should call onCheckComplete callback for each check', async () => {
      const onCheckComplete = vi.fn()
      const mockHtml = '<html><body><h1>Test</h1></body></html>'

      vi.mocked(crawler.crawlSite).mockImplementation(async (_url, _auditId, options) => {
        if (options.onPageCrawled) {
          await options.onPageCrawled(
            {
              id: 'page-1',
              audit_id: 'test-audit',
              url: 'https://example.com',
              title: 'Test',
              meta_description: null,
              status_code: 200,
              last_modified: null,
              crawled_at: new Date().toISOString(),
              is_resource: false,
              resource_type: null,
            },
            mockHtml
          )
        }

        return { pages: [], errors: [], stopped: false }
      })

      await runAIOChecks({
        auditId: 'test-audit',
        url: 'https://example.com',
        sampleSize: 1,
        onCheckComplete,
      })

      // Should have called callback for each check
      expect(onCheckComplete).toHaveBeenCalled()
      expect(onCheckComplete.mock.calls.length).toBeGreaterThan(0)

      // Each call should receive a AIOCheck object
      const firstCall = onCheckComplete.mock.calls[0][0] as AIOCheck
      expect(firstCall).toHaveProperty('id')
      expect(firstCall).toHaveProperty('audit_id', 'test-audit')
      expect(firstCall).toHaveProperty('category')
      expect(firstCall).toHaveProperty('status')
    })
  })

  describe('getCategoryScores', () => {
    it('should calculate scores by category', () => {
      const checks: AIOCheck[] = [
        {
          id: '1',
          audit_id: 'test',
          category: 'technical_foundation',
          check_name: 'test_1',
          priority: 'critical',
          status: 'passed',
          details: null,
          display_name: 'Test 1',
          display_name_passed: null,
          description: 'Test',
          fix_guidance: null,
          learn_more_url: null,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          audit_id: 'test',
          category: 'technical_foundation',
          check_name: 'test_2',
          priority: 'recommended',
          status: 'failed',
          details: null,
          display_name: 'Test 2',
          display_name_passed: null,
          description: 'Test',
          fix_guidance: null,
          learn_more_url: null,
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          audit_id: 'test',
          category: 'content_structure',
          check_name: 'test_3',
          priority: 'recommended',
          status: 'passed',
          details: null,
          display_name: 'Test 3',
          display_name_passed: null,
          description: 'Test',
          fix_guidance: null,
          learn_more_url: null,
          created_at: new Date().toISOString(),
        },
      ]

      const scores = getCategoryScores(checks)

      expect(scores).toHaveProperty('technicalFoundation')
      expect(scores).toHaveProperty('contentStructure')
      expect(scores).toHaveProperty('contentQuality')

      // Technical foundation has 1 critical pass (3x100) + 1 recommended fail (2x0) = 300/5 = 60
      expect(scores.technicalFoundation).toBe(60)

      // Content structure has 1 recommended pass (2x100) = 100
      expect(scores.contentStructure).toBe(100)

      // Content quality has no checks = 0
      expect(scores.contentQuality).toBe(0)
    })

    it('should handle warning status with 50 points', () => {
      const checks: AIOCheck[] = [
        {
          id: '1',
          audit_id: 'test',
          category: 'content_quality',
          check_name: 'test_1',
          priority: 'recommended',
          status: 'warning',
          details: null,
          display_name: 'Test 1',
          display_name_passed: null,
          description: 'Test',
          fix_guidance: null,
          learn_more_url: null,
          created_at: new Date().toISOString(),
        },
      ]

      const scores = getCategoryScores(checks)

      // Recommended warning: 2 * 50 = 100/2 = 50
      expect(scores.contentQuality).toBe(50)
    })
  })
})
