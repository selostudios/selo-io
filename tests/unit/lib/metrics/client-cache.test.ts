import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getCacheEntry,
  isCacheEntryFresh,
  setCacheEntry,
  invalidateAllCacheEntries,
} from '@/lib/metrics/client-cache'

afterEach(() => {
  invalidateAllCacheEntries()
  vi.useRealTimers()
})

describe('getCacheEntry', () => {
  it('returns undefined for a key that has not been set', () => {
    expect(getCacheEntry('conn-1', '7d')).toBeUndefined()
  })

  it('returns the entry after it has been set', () => {
    setCacheEntry('conn-1', '7d', { value: 42 }, [])
    const entry = getCacheEntry('conn-1', '7d')
    expect(entry).toBeDefined()
    expect(entry!.metrics).toEqual({ value: 42 })
    expect(entry!.timeSeries).toEqual([])
  })
})

describe('setCacheEntry', () => {
  it('stores independent entries for different connectionId+period combinations', () => {
    setCacheEntry('conn-1', '7d', 'a', [])
    setCacheEntry('conn-1', '30d', 'b', [])
    setCacheEntry('conn-2', '7d', 'c', [])

    expect(getCacheEntry('conn-1', '7d')!.metrics).toBe('a')
    expect(getCacheEntry('conn-1', '30d')!.metrics).toBe('b')
    expect(getCacheEntry('conn-2', '7d')!.metrics).toBe('c')
  })

  it('overwrites a previous entry for the same key', () => {
    setCacheEntry('conn-1', '7d', 'old', [])
    setCacheEntry('conn-1', '7d', 'new', [])
    expect(getCacheEntry('conn-1', '7d')!.metrics).toBe('new')
  })
})

describe('isCacheEntryFresh', () => {
  it('returns true for an entry created just now', () => {
    setCacheEntry('conn-1', '7d', null, [])
    const entry = getCacheEntry('conn-1', '7d')!
    expect(isCacheEntryFresh(entry)).toBe(true)
  })

  it('returns false for an entry older than 30 minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T10:00:00Z'))

    setCacheEntry('conn-1', '7d', null, [])

    // Advance 31 minutes
    vi.setSystemTime(new Date('2026-04-16T10:31:00Z'))

    const entry = getCacheEntry('conn-1', '7d')!
    expect(isCacheEntryFresh(entry)).toBe(false)
  })

  it('returns true for an entry exactly 29 minutes old', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T10:00:00Z'))

    setCacheEntry('conn-1', '7d', null, [])

    // Advance 29 minutes
    vi.setSystemTime(new Date('2026-04-16T10:29:00Z'))

    const entry = getCacheEntry('conn-1', '7d')!
    expect(isCacheEntryFresh(entry)).toBe(true)
  })
})

describe('invalidateAllCacheEntries', () => {
  it('removes all cached entries', () => {
    setCacheEntry('conn-1', '7d', 'a', [])
    setCacheEntry('conn-2', '30d', 'b', [])

    invalidateAllCacheEntries()

    expect(getCacheEntry('conn-1', '7d')).toBeUndefined()
    expect(getCacheEntry('conn-2', '30d')).toBeUndefined()
  })
})
