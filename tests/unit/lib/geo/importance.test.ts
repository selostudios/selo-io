import { describe, expect, it } from 'vitest'
import {
  calculatePageImportance,
  selectTopPages,
  getAverageImportance,
} from '@/lib/geo/importance'
import type { SiteAuditPage } from '@/lib/audit/types'

describe('Page Importance', () => {
  const baseUrl = 'https://example.com'

  const createPage = (url: string, overrides?: Partial<SiteAuditPage>): SiteAuditPage => ({
    id: crypto.randomUUID(),
    audit_id: 'test',
    url,
    title: 'Test Page',
    meta_description: 'Test description',
    status_code: 200,
    last_modified: null,
    crawled_at: new Date().toISOString(),
    is_resource: false,
    resource_type: null,
    ...overrides,
  })

  describe('calculatePageImportance', () => {
    it('should give homepage highest score', () => {
      const homepage = createPage('https://example.com/')
      const allPages = [homepage]

      const result = calculatePageImportance(homepage, allPages, baseUrl)

      expect(result.importanceScore).toBeGreaterThan(90)
      expect(result.reasons).toContain('Homepage')
    })

    it('should score top-level pages higher than deep pages', () => {
      const topLevel = createPage('https://example.com/about')
      const deepPage = createPage('https://example.com/blog/2024/january/post')
      const allPages = [topLevel, deepPage]

      const topLevelScore = calculatePageImportance(topLevel, allPages, baseUrl)
      const deepPageScore = calculatePageImportance(deepPage, allPages, baseUrl)

      expect(topLevelScore.importanceScore).toBeGreaterThan(deepPageScore.importanceScore)
      expect(topLevelScore.reasons).toContain('Top-level page')
    })

    it('should boost important URL patterns', () => {
      const aboutPage = createPage('https://example.com/about')
      const genericPage = createPage('https://example.com/random')
      const allPages = [aboutPage, genericPage]

      const aboutScore = calculatePageImportance(aboutPage, allPages, baseUrl)
      const genericScore = calculatePageImportance(genericPage, allPages, baseUrl)

      expect(aboutScore.importanceScore).toBeGreaterThan(genericScore.importanceScore)
      expect(aboutScore.reasons).toContain('Core service page')
    })

    it('should penalize resources', () => {
      const htmlPage = createPage('https://example.com/guide')
      const pdfPage = createPage('https://example.com/guide.pdf', {
        is_resource: true,
        resource_type: 'pdf',
      })
      const allPages = [htmlPage, pdfPage]

      const htmlScore = calculatePageImportance(htmlPage, allPages, baseUrl)
      const pdfScore = calculatePageImportance(pdfPage, allPages, baseUrl)

      expect(htmlScore.importanceScore).toBeGreaterThan(pdfScore.importanceScore)
      expect(pdfScore.reasons).toContain('Resource file (pdf)')
    })

    it('should penalize non-200 status codes', () => {
      const okPage = createPage('https://example.com/page')
      const notFoundPage = createPage('https://example.com/missing', { status_code: 404 })
      const allPages = [okPage, notFoundPage]

      const okScore = calculatePageImportance(okPage, allPages, baseUrl)
      const notFoundScore = calculatePageImportance(notFoundPage, allPages, baseUrl)

      expect(okScore.importanceScore).toBeGreaterThan(notFoundScore.importanceScore)
      expect(notFoundScore.reasons).toContain('Non-200 status (404)')
    })

    it('should boost recently updated pages', () => {
      const recentPage = createPage('https://example.com/recent', {
        last_modified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      })
      const oldPage = createPage('https://example.com/old', {
        last_modified: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // 400 days ago
      })
      const allPages = [recentPage, oldPage]

      const recentScore = calculatePageImportance(recentPage, allPages, baseUrl)
      const oldScore = calculatePageImportance(oldPage, allPages, baseUrl)

      expect(recentScore.importanceScore).toBeGreaterThan(oldScore.importanceScore)
      expect(recentScore.reasons).toContain('Recently updated (< 30 days)')
      expect(oldScore.reasons).toContain('Not updated in over a year')
    })

    it('should penalize pages without titles', () => {
      const withTitle = createPage('https://example.com/titled')
      const withoutTitle = createPage('https://example.com/untitled', { title: null })
      const allPages = [withTitle, withoutTitle]

      const titledScore = calculatePageImportance(withTitle, allPages, baseUrl)
      const untitledScore = calculatePageImportance(withoutTitle, allPages, baseUrl)

      expect(titledScore.importanceScore).toBeGreaterThan(untitledScore.importanceScore)
      expect(untitledScore.reasons).toContain('Missing title')
    })
  })

  describe('selectTopPages', () => {
    it('should select top N pages by importance', () => {
      const pages = [
        createPage('https://example.com/'), // Homepage - highest
        createPage('https://example.com/about'), // Important pattern
        createPage('https://example.com/blog/post-1'), // Deeper
        createPage('https://example.com/blog/post-2'), // Deeper
        createPage('https://example.com/privacy'), // Low priority
      ]

      const topPages = selectTopPages(pages, baseUrl, 3)

      expect(topPages).toHaveLength(3)
      expect(topPages[0].url).toBe('https://example.com/')
      expect(topPages.every((p) => p.importanceScore >= 0)).toBe(true)
    })

    it('should always include homepage if present', () => {
      const pages = [
        createPage('https://example.com/docs/guide', {
          title: 'Super Important Guide',
        }),
        createPage('https://example.com/'),
        createPage('https://example.com/blog'),
      ]

      const topPages = selectTopPages(pages, baseUrl, 2)

      expect(topPages).toHaveLength(2)
      expect(topPages.some((p) => p.url === 'https://example.com/')).toBe(true)
    })

    it('should handle empty page list', () => {
      const topPages = selectTopPages([], baseUrl, 5)

      expect(topPages).toHaveLength(0)
    })

    it('should handle request for more pages than available', () => {
      const pages = [
        createPage('https://example.com/'),
        createPage('https://example.com/about'),
      ]

      const topPages = selectTopPages(pages, baseUrl, 10)

      expect(topPages).toHaveLength(2)
    })
  })

  describe('getAverageImportance', () => {
    it('should calculate average importance across all pages', () => {
      const pages = [
        createPage('https://example.com/'),
        createPage('https://example.com/about'),
        createPage('https://example.com/blog/deep/post'),
      ]

      const avgImportance = getAverageImportance(pages, baseUrl)

      expect(avgImportance).toBeGreaterThan(0)
      expect(avgImportance).toBeLessThanOrEqual(100)
    })

    it('should return 0 for empty page list', () => {
      const avgImportance = getAverageImportance([], baseUrl)

      expect(avgImportance).toBe(0)
    })
  })
})
