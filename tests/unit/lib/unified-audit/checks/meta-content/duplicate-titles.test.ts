import { describe, it, expect } from 'vitest'
import { duplicateTitles } from '@/lib/unified-audit/checks/meta-content/duplicate-titles'
import type { CheckContext } from '@/lib/unified-audit/types'

function makeContext(allPages: CheckContext['allPages']): CheckContext {
  return {
    url: 'https://example.com',
    html: '<html></html>',
    title: undefined,
    statusCode: 200,
    allPages,
  }
}

function makePage(url: string, title: string | null, statusCode = 200) {
  return {
    url,
    title,
    statusCode,
  }
}

describe('duplicateTitles check', () => {
  it('should pass when all titles are unique', async () => {
    const context = makeContext([
      makePage('https://example.com', 'Home'),
      makePage('https://example.com/about', 'About Us'),
      makePage('https://example.com/contact', 'Contact'),
    ])

    const result = await duplicateTitles.run(context)

    expect(result.status).toBe('passed')
    expect(result.details?.uniqueTitles).toBe(3)
  })

  it('should fail when duplicate titles exist', async () => {
    const context = makeContext([
      makePage('https://example.com/page-1', 'Same Title'),
      makePage('https://example.com/page-2', 'Same Title'),
      makePage('https://example.com/page-3', 'Unique Title'),
    ])

    const result = await duplicateTitles.run(context)

    expect(result.status).toBe('failed')
    expect(result.details?.duplicateCount).toBe(1)
    expect(result.details?.affectedPages).toBe(2)
  })

  it('should detect multiple groups of duplicates', async () => {
    const context = makeContext([
      makePage('https://example.com/a', 'Title A'),
      makePage('https://example.com/b', 'Title A'),
      makePage('https://example.com/c', 'Title B'),
      makePage('https://example.com/d', 'Title B'),
      makePage('https://example.com/e', 'Title B'),
    ])

    const result = await duplicateTitles.run(context)

    expect(result.status).toBe('failed')
    expect(result.details?.duplicateCount).toBe(2)
    expect(result.details?.affectedPages).toBe(5)
  })

  it('should skip pages without titles', async () => {
    const context = makeContext([
      makePage('https://example.com/a', null),
      makePage('https://example.com/b', null),
      makePage('https://example.com/c', 'Unique'),
    ])

    const result = await duplicateTitles.run(context)

    expect(result.status).toBe('passed')
  })

  it('should skip error pages (4xx/5xx)', async () => {
    const context = makeContext([
      makePage('https://example.com/a', 'Same Title', 200),
      makePage('https://example.com/b', 'Same Title', 404),
    ])

    const result = await duplicateTitles.run(context)

    expect(result.status).toBe('passed')
  })

  it('should be marked as site-wide', () => {
    expect(duplicateTitles.isSiteWide).toBe(true)
  })
})
