import { describe, it, expect } from 'vitest'
import { metaDescriptionLength } from '@/lib/unified-audit/checks/meta-content/meta-description-length'
import type { CheckContext } from '@/lib/unified-audit/types'

function makeContext(metaContent: string | null): CheckContext {
  const metaTag = metaContent !== null ? `<meta name="description" content="${metaContent}">` : ''
  return {
    url: 'https://example.com',
    html: `<html><head>${metaTag}</head></html>`,
    title: undefined,
    statusCode: 200,
    allPages: [],
  }
}

describe('metaDescriptionLength check', () => {
  it('should pass when description is in optimal range (120-160)', async () => {
    const desc = 'A'.repeat(150)
    const result = await metaDescriptionLength.run(makeContext(desc))

    expect(result.status).toBe('passed')
    expect(result.details?.message).toContain('characters (optimal)')
  })

  it('should pass at lower boundary (120 characters)', async () => {
    const desc = 'A'.repeat(120)
    const result = await metaDescriptionLength.run(makeContext(desc))

    expect(result.status).toBe('passed')
  })

  it('should pass at upper boundary (160 characters)', async () => {
    const desc = 'A'.repeat(160)
    const result = await metaDescriptionLength.run(makeContext(desc))

    expect(result.status).toBe('passed')
  })

  it('should warn when description is too short (< 120)', async () => {
    const desc = 'A'.repeat(119)
    const result = await metaDescriptionLength.run(makeContext(desc))

    expect(result.status).toBe('warning')
    expect(result.details?.length).toBe(119)
  })

  it('should warn when description is too long (> 160)', async () => {
    const desc = 'A'.repeat(161)
    const result = await metaDescriptionLength.run(makeContext(desc))

    expect(result.status).toBe('warning')
    expect(result.details?.length).toBe(161)
  })

  it('should pass when meta description is missing (handled by separate check)', async () => {
    const result = await metaDescriptionLength.run(makeContext(null))

    expect(result.status).toBe('passed')
  })

  it('should pass when meta description is empty (handled by separate check)', async () => {
    const result = await metaDescriptionLength.run(makeContext(''))

    expect(result.status).toBe('passed')
  })
})
