import { describe, it, expect } from 'vitest'
import { generateUTMParameters, buildUTMUrl } from '@/lib/utils/utm'

describe('generateUTMParameters', () => {
  it('converts campaign name to URL-safe slug', () => {
    const result = generateUTMParameters('My Campaign Name')
    expect(result.utm_campaign).toBe('my-campaign-name')
  })

  it('strips special characters', () => {
    const result = generateUTMParameters('Campaign #1 (Q1)')
    expect(result.utm_campaign).toBe('campaign-1-q1')
  })

  it('removes leading and trailing hyphens from consecutive special chars', () => {
    const result = generateUTMParameters('---test---')
    expect(result.utm_campaign).toBe('test')
  })

  it('collapses consecutive non-alphanumeric chars into single hyphen', () => {
    const result = generateUTMParameters('hello   world!!!')
    expect(result.utm_campaign).toBe('hello-world')
  })

  it('returns empty campaign for empty name', () => {
    const result = generateUTMParameters('')
    expect(result.utm_campaign).toBe('')
  })

  it('always sets source to selo and medium to organic', () => {
    const result = generateUTMParameters('test')
    expect(result.utm_source).toBe('selo')
    expect(result.utm_medium).toBe('organic')
  })

  it('leaves term and content empty', () => {
    const result = generateUTMParameters('test')
    expect(result.utm_term).toBe('')
    expect(result.utm_content).toBe('')
  })
})

describe('buildUTMUrl', () => {
  it('appends UTM params to a URL', () => {
    const result = buildUTMUrl('https://example.com', {
      utm_source: 'selo',
      utm_campaign: 'test',
    })
    expect(result).toContain('utm_source=selo')
    expect(result).toContain('utm_campaign=test')
  })

  it('preserves existing query parameters', () => {
    const result = buildUTMUrl('https://example.com?page=1', {
      utm_source: 'selo',
    })
    expect(result).toContain('page=1')
    expect(result).toContain('utm_source=selo')
  })

  it('skips empty param values', () => {
    const result = buildUTMUrl('https://example.com', {
      utm_source: 'selo',
      utm_term: '',
    })
    expect(result).toContain('utm_source=selo')
    expect(result).not.toContain('utm_term')
  })

  it('returns original string for invalid URL', () => {
    const result = buildUTMUrl('not-a-url', { utm_source: 'selo' })
    expect(result).toBe('not-a-url')
  })
})
