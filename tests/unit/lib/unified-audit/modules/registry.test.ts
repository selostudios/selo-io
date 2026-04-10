import { describe, test, expect } from 'vitest'
import { auditModules, getModule } from '@/lib/unified-audit/modules/registry'
import { ScoreDimension } from '@/lib/enums'

describe('auditModules registry', () => {
  test('exports exactly 3 modules', () => {
    expect(auditModules).toHaveLength(3)
  })

  test('each module has a unique dimension', () => {
    const dimensions = auditModules.map((m) => m.dimension)
    expect(new Set(dimensions).size).toBe(3)
  })

  test('contains SEO, Performance, and AIReadiness modules', () => {
    const dimensions = auditModules.map((m) => m.dimension)
    expect(dimensions).toContain(ScoreDimension.SEO)
    expect(dimensions).toContain(ScoreDimension.Performance)
    expect(dimensions).toContain(ScoreDimension.AIReadiness)
  })

  test('each module has a non-empty checks array', () => {
    for (const mod of auditModules) {
      expect(mod.checks.length).toBeGreaterThan(0)
    }
  })

  test('each module has a calculateScore function', () => {
    for (const mod of auditModules) {
      expect(typeof mod.calculateScore).toBe('function')
    }
  })

  test('only Performance and AIReadiness have post-crawl phases', () => {
    const seo = auditModules.find((m) => m.dimension === ScoreDimension.SEO)!
    const perf = auditModules.find((m) => m.dimension === ScoreDimension.Performance)!
    const ai = auditModules.find((m) => m.dimension === ScoreDimension.AIReadiness)!
    expect(seo.runPostCrawlPhase).toBeUndefined()
    expect(perf.runPostCrawlPhase).toBeDefined()
    expect(ai.runPostCrawlPhase).toBeDefined()
  })
})

describe('getModule', () => {
  test('returns module for valid dimension', () => {
    const mod = getModule(ScoreDimension.SEO)
    expect(mod).toBeDefined()
    expect(mod!.dimension).toBe(ScoreDimension.SEO)
  })

  test('returns undefined for invalid dimension', () => {
    const mod = getModule('invalid' as ScoreDimension)
    expect(mod).toBeUndefined()
  })
})
