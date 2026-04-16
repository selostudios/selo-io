import type { MetricTimeSeries } from '@/lib/metrics/types'

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  metrics: unknown
  timeSeries: MetricTimeSeries[]
  cachedAt: number
}

const cache = new Map<string, CacheEntry>()

function buildKey(connectionId: string, period: string): string {
  return `${connectionId}:${period}`
}

export function getCacheEntry(connectionId: string, period: string): CacheEntry | undefined {
  return cache.get(buildKey(connectionId, period))
}

export function isCacheEntryFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt < CACHE_TTL_MS
}

export function setCacheEntry(
  connectionId: string,
  period: string,
  metrics: unknown,
  timeSeries: MetricTimeSeries[]
): void {
  cache.set(buildKey(connectionId, period), {
    metrics,
    timeSeries,
    cachedAt: Date.now(),
  })
}

export function invalidateAllCacheEntries(): void {
  cache.clear()
}
