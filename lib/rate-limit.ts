/**
 * Reusable rate limiter with in-memory sliding window.
 *
 * LIMITATION: In-memory storage only persists within a single serverless
 * function instance. On Vercel, each cold start creates a new store.
 * This provides partial protection (warm instances) but is NOT a complete
 * solution. Upgrade to Redis-backed storage (e.g. Upstash) before launch.
 *
 * See CLAUDE.md "Rate Limiting" section for upgrade guidance.
 *
 * Usage:
 *   const limiter = createRateLimiter('login', { interval: 900_000, maxRequests: 10 })
 *   const ip = getIpFromRequest(request)
 *   const result = limiter.check(ip)
 *   if (!result.success) return new Response('Too many requests', { status: 429 })
 */

import { headers } from 'next/headers'

export interface RateLimitResult {
  success: boolean
  remaining: number
  /** Unix ms when the window resets */
  reset: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  interval: number
  /** Maximum requests per window */
  maxRequests: number
}

// Shared stores across warm invocations (one Map per named limiter)
const stores = new Map<string, Map<string, RateLimitEntry>>()

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL = 60_000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const store of stores.values()) {
      for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)
  // Don't keep the process alive just for cleanup
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  if (!stores.has(name)) {
    stores.set(name, new Map())
  }
  ensureCleanup()

  return {
    check(key: string): RateLimitResult {
      const store = stores.get(name)!
      const now = Date.now()
      const entry = store.get(key)

      // Window expired or first request — start fresh
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + options.interval })
        return { success: true, remaining: options.maxRequests - 1, reset: now + options.interval }
      }

      // Over limit
      if (entry.count >= options.maxRequests) {
        return { success: false, remaining: 0, reset: entry.resetAt }
      }

      // Within limit
      entry.count++
      return {
        success: true,
        remaining: options.maxRequests - entry.count,
        reset: entry.resetAt,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// IP extraction helpers
// ---------------------------------------------------------------------------

/** Extract client IP from a Request object (API routes). */
export function getIpFromRequest(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/** Extract client IP from Next.js headers (server actions). */
export async function getIpFromHeaders(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

/** Login: 10 attempts per 15 minutes per IP */
export const loginLimiter = createRateLimiter('login', {
  interval: 15 * 60 * 1000,
  maxRequests: 10,
})

/** Sign-up: 5 attempts per 15 minutes per IP */
export const signupLimiter = createRateLimiter('signup', {
  interval: 15 * 60 * 1000,
  maxRequests: 5,
})

/** OAuth initiation: 10 per 15 minutes per IP */
export const oauthLimiter = createRateLimiter('oauth', {
  interval: 15 * 60 * 1000,
  maxRequests: 10,
})

/** Email invites: 10 per hour per IP (covers send, resend, internal invite) */
export const inviteLimiter = createRateLimiter('invite', {
  interval: 60 * 60 * 1000,
  maxRequests: 10,
})

/** General API: 100 requests per hour per IP */
export const apiLimiter = createRateLimiter('api', {
  interval: 60 * 60 * 1000,
  maxRequests: 100,
})
