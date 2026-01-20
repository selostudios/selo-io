import { describe, it, expect } from 'vitest'
import { missingMetaDescription } from '@/lib/audit/checks/seo/missing-meta-description'
import type { CheckContext } from '@/lib/audit/types'

describe('missingMetaDescription check', () => {
  it('should pass when meta description exists', async () => {
    const context: CheckContext = {
      url: 'https://example.com',
      html: '<html><head><meta name="description" content="Test description"></head></html>',
      title: 'Test',
      statusCode: 200,
      allPages: [],
    }

    const result = await missingMetaDescription.run(context)

    expect(result.status).toBe('passed')
  })

  it('should fail when meta description is missing', async () => {
    const context: CheckContext = {
      url: 'https://example.com',
      html: '<html><head><title>Test</title></head></html>',
      title: 'Test',
      statusCode: 200,
      allPages: [],
    }

    const result = await missingMetaDescription.run(context)

    expect(result.status).toBe('failed')
  })

  it('should fail when meta description is empty', async () => {
    const context: CheckContext = {
      url: 'https://example.com',
      html: '<html><head><meta name="description" content=""></head></html>',
      title: 'Test',
      statusCode: 200,
      allPages: [],
    }

    const result = await missingMetaDescription.run(context)

    expect(result.status).toBe('failed')
  })
})
