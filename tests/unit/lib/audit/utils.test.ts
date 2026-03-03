import { describe, it, expect } from 'vitest'
import { isSoft404, isCheckablePage } from '@/lib/audit/utils'

describe('isSoft404', () => {
  it('returns false for normal titles', () => {
    expect(isSoft404('Welcome to Our Site', 200)).toBe(false)
    expect(isSoft404('About Us', 200)).toBe(false)
    expect(isSoft404('Products & Services', 200)).toBe(false)
  })

  it('returns true for titles containing "404"', () => {
    expect(isSoft404('404 - Page Not Found', 200)).toBe(true)
    expect(isSoft404('Error 404', 200)).toBe(true)
  })

  it('returns true for "Page Not Found" titles', () => {
    expect(isSoft404('Page Not Found', 200)).toBe(true)
    expect(isSoft404('page not found', 200)).toBe(true)
    expect(isSoft404('Oops! Page Not Found', 200)).toBe(true)
  })

  it('returns true for "Not Found" titles', () => {
    expect(isSoft404('Not Found', 200)).toBe(true)
    expect(isSoft404('Resource Not Found', 200)).toBe(true)
  })

  it('does not false-positive on normal titles containing "found"', () => {
    expect(isSoft404('We Found the Best Deals', 200)).toBe(false)
    expect(isSoft404('Lost and Found Items', 200)).toBe(false)
  })

  it('returns false for null titles', () => {
    expect(isSoft404(null, 200)).toBe(false)
  })

  it('returns false for non-200 status codes (handled by status code check instead)', () => {
    expect(isSoft404('404 Not Found', 404)).toBe(false)
    expect(isSoft404('Server Error', 500)).toBe(false)
  })
})

describe('isCheckablePage', () => {
  it('returns true for normal 200 pages', () => {
    expect(isCheckablePage({ status_code: 200, title: 'Home Page' })).toBe(true)
  })

  it('returns true for redirects (3xx)', () => {
    expect(isCheckablePage({ status_code: 301, title: 'Moved' })).toBe(true)
    expect(isCheckablePage({ status_code: 302, title: null })).toBe(true)
  })

  it('returns false for 404 pages', () => {
    expect(isCheckablePage({ status_code: 404, title: 'Not Found' })).toBe(false)
  })

  it('returns false for 500 pages', () => {
    expect(isCheckablePage({ status_code: 500, title: 'Internal Server Error' })).toBe(false)
  })

  it('returns false for other 4xx/5xx codes', () => {
    expect(isCheckablePage({ status_code: 403, title: 'Forbidden' })).toBe(false)
    expect(isCheckablePage({ status_code: 410, title: 'Gone' })).toBe(false)
    expect(isCheckablePage({ status_code: 503, title: 'Service Unavailable' })).toBe(false)
  })

  it('returns false for soft 404s (200 with error title)', () => {
    expect(isCheckablePage({ status_code: 200, title: 'Page Not Found' })).toBe(false)
    expect(isCheckablePage({ status_code: 200, title: '404 Error' })).toBe(false)
  })

  it('returns true when status_code is null (defaults to 200)', () => {
    expect(isCheckablePage({ status_code: null, title: 'Normal Page' })).toBe(true)
  })

  it('returns false for null status_code with soft 404 title', () => {
    expect(isCheckablePage({ status_code: null, title: 'Page Not Found' })).toBe(false)
  })
})
