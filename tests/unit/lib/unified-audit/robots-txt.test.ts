import { describe, it, expect } from 'vitest'
import { resolveRobotsTxtRules, isPathAllowed } from '@/lib/unified-audit/robots-txt'

describe('resolveRobotsTxtRules', () => {
  it('resolves basic disallow rules from wildcard block', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /admin\nDisallow: /private`)

    expect(resolved).not.toBeNull()
    expect(resolved!.rules).toEqual([
      { type: 'disallow', path: '/admin' },
      { type: 'disallow', path: '/private' },
    ])
  })

  it('resolves allow and disallow rules together', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /api\nAllow: /api/public`)

    expect(resolved!.rules).toEqual([
      { type: 'disallow', path: '/api' },
      { type: 'allow', path: '/api/public' },
    ])
  })

  it('prefers SeloIOBot-specific block over wildcard', () => {
    const resolved = resolveRobotsTxtRules(
      `User-agent: SeloIOBot\nDisallow: /no-selo\n\nUser-agent: *\nDisallow: /secret`
    )

    expect(resolved!.rules).toEqual([{ type: 'disallow', path: '/no-selo' }])
  })

  it('resolves crawl-delay in milliseconds', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nCrawl-delay: 2\nDisallow: /admin`)

    expect(resolved!.crawlDelayMs).toBe(2000)
  })

  it('returns null crawlDelayMs when not set', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /admin`)

    expect(resolved!.crawlDelayMs).toBeNull()
  })

  it('returns null when no relevant blocks exist', () => {
    const resolved = resolveRobotsTxtRules('')

    expect(resolved).toBeNull()
  })

  it('ignores comments', () => {
    const resolved = resolveRobotsTxtRules(`# Comment\nUser-agent: *\nDisallow: /admin # no admin`)

    expect(resolved!.rules[0].path).toBe('/admin')
  })

  it('handles empty disallow (no rules)', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow:`)

    expect(resolved!.rules).toHaveLength(0)
  })
})

describe('isPathAllowed', () => {
  it('allows all paths when rules are empty', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow:`)!
    expect(isPathAllowed(resolved, '/anything')).toBe(true)
  })

  it('blocks disallowed paths', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /admin`)!
    expect(isPathAllowed(resolved, '/admin')).toBe(false)
    expect(isPathAllowed(resolved, '/admin/settings')).toBe(false)
    expect(isPathAllowed(resolved, '/about')).toBe(true)
  })

  it('allows paths with Allow override on longer match', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /api\nAllow: /api/public`)!
    expect(isPathAllowed(resolved, '/api/private')).toBe(false)
    expect(isPathAllowed(resolved, '/api/public')).toBe(true)
    expect(isPathAllowed(resolved, '/api/public/docs')).toBe(true)
  })

  it('blocks root disallow', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /`)!
    expect(isPathAllowed(resolved, '/')).toBe(false)
    expect(isPathAllowed(resolved, '/page')).toBe(false)
  })

  it('equal length match favors allow', () => {
    const resolved = resolveRobotsTxtRules(`User-agent: *\nDisallow: /test\nAllow: /test`)!
    expect(isPathAllowed(resolved, '/test')).toBe(true)
  })

  it('works with pre-resolved rules loaded from JSON', () => {
    // Simulates loading from JSONB — no parsing needed
    const fromDb = {
      rules: [
        { type: 'disallow' as const, path: '/secret' },
        { type: 'allow' as const, path: '/secret/public' },
      ],
      crawlDelayMs: 1000,
    }

    expect(isPathAllowed(fromDb, '/secret')).toBe(false)
    expect(isPathAllowed(fromDb, '/secret/public')).toBe(true)
    expect(isPathAllowed(fromDb, '/open')).toBe(true)
  })
})
