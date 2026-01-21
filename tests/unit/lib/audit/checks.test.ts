import { describe, it, expect } from 'vitest'
import { missingMetaDescription } from '@/lib/audit/checks/seo/missing-meta-description'
import { missingTitle } from '@/lib/audit/checks/seo/missing-title'
import { missingLlmsTxt } from '@/lib/audit/checks/ai/missing-llms-txt'
import type { CheckContext } from '@/lib/audit/types'

// Helper to create a basic CheckContext
function createContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    url: 'https://example.com',
    html: '<html><head></head><body></body></html>',
    title: null,
    statusCode: 200,
    allPages: [],
    ...overrides,
  }
}

describe('SEO Checks', () => {
  describe('missingMetaDescription', () => {
    it('passes when meta description exists', async () => {
      const context = createContext({
        html: '<html><head><meta name="description" content="A great page about something"></head></html>',
      })
      const result = await missingMetaDescription.run(context)
      expect(result.status).toBe('passed')
    })

    it('fails when meta description is missing', async () => {
      const context = createContext({
        html: '<html><head><title>Test</title></head></html>',
      })
      const result = await missingMetaDescription.run(context)
      expect(result.status).toBe('failed')
    })

    it('fails when meta description is empty', async () => {
      const context = createContext({
        html: '<html><head><meta name="description" content=""></head></html>',
      })
      const result = await missingMetaDescription.run(context)
      expect(result.status).toBe('failed')
    })

    it('fails when meta description contains only whitespace', async () => {
      const context = createContext({
        html: '<html><head><meta name="description" content="   "></head></html>',
      })
      const result = await missingMetaDescription.run(context)
      expect(result.status).toBe('failed')
    })

    it('has correct metadata', () => {
      expect(missingMetaDescription.name).toBe('missing_meta_description')
      expect(missingMetaDescription.type).toBe('seo')
      expect(missingMetaDescription.priority).toBe('critical')
    })
  })

  describe('missingTitle', () => {
    it('passes when title exists', async () => {
      const context = createContext({
        html: '<html><head><title>My Website - Home</title></head></html>',
      })
      const result = await missingTitle.run(context)
      expect(result.status).toBe('passed')
    })

    it('fails when title is missing', async () => {
      const context = createContext({
        html: '<html><head></head><body></body></html>',
      })
      const result = await missingTitle.run(context)
      expect(result.status).toBe('failed')
    })

    it('fails when title is empty', async () => {
      const context = createContext({
        html: '<html><head><title></title></head></html>',
      })
      const result = await missingTitle.run(context)
      expect(result.status).toBe('failed')
    })

    it('fails when title contains only whitespace', async () => {
      const context = createContext({
        html: '<html><head><title>   </title></head></html>',
      })
      const result = await missingTitle.run(context)
      expect(result.status).toBe('failed')
    })

    it('has correct metadata', () => {
      expect(missingTitle.name).toBe('missing_title')
      expect(missingTitle.type).toBe('seo')
      expect(missingTitle.priority).toBe('critical')
    })
  })
})

describe('AI Readiness Checks', () => {
  describe('missingLlmsTxt', () => {
    // Note: This check fetches /llms.txt, so testing the actual run requires mocking fetch
    // For now, we test that the check has correct metadata
    it('has correct metadata', () => {
      expect(missingLlmsTxt.name).toBe('missing_llms_txt')
      expect(missingLlmsTxt.type).toBe('ai_readiness')
      expect(missingLlmsTxt.priority).toBe('critical')
    })

    it('has a description', () => {
      expect(missingLlmsTxt.description).toBeDefined()
      expect(missingLlmsTxt.description.length).toBeGreaterThan(0)
    })
  })
})
