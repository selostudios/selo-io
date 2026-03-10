import { describe, it, expect } from 'vitest'
import { titleLength } from '@/lib/unified-audit/checks/meta-content/title-length'
import type { CheckContext } from '@/lib/unified-audit/types'

function makeContext(html: string): CheckContext {
  return {
    url: 'https://example.com',
    html,
    title: undefined,
    statusCode: 200,
    allPages: [],
  }
}

describe('titleLength check', () => {
  it('should pass when title is under 60 characters', async () => {
    const result = await titleLength.run(
      makeContext('<html><head><title>Short Title</title></head></html>')
    )

    expect(result.status).toBe('passed')
    expect(result.details?.message).toContain('characters (good)')
  })

  it('should pass when title is exactly 60 characters', async () => {
    const title = 'A'.repeat(60)
    const result = await titleLength.run(
      makeContext(`<html><head><title>${title}</title></head></html>`)
    )

    expect(result.status).toBe('passed')
  })

  it('should warn when title exceeds 60 characters', async () => {
    const title = 'A'.repeat(61)
    const result = await titleLength.run(
      makeContext(`<html><head><title>${title}</title></head></html>`)
    )

    expect(result.status).toBe('warning')
    expect(result.details?.length).toBe(61)
  })

  it('should pass when title is missing (handled by missing_title check)', async () => {
    const result = await titleLength.run(makeContext('<html><head></head></html>'))

    expect(result.status).toBe('passed')
  })

  it('should pass when title is empty (handled by missing_title check)', async () => {
    const result = await titleLength.run(makeContext('<html><head><title>  </title></head></html>'))

    expect(result.status).toBe('passed')
  })
})
