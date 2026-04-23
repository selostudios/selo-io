import { vi } from 'vitest'

// Supabase's PostgREST client is chainable — non-terminal methods
// (`select`, `eq`, `order`, etc.) return `this` and terminal methods
// (`maybeSingle`, `single`, or whichever call ends the chain) resolve to
// `{ data, error }`. Tests that mock this API end up repeating ~15 lines
// of boilerplate per table; this helper centralises it.
//
// Default behaviour:
//   - Transformation methods (select/insert/update/upsert/delete, eq/neq/in,
//     order/limit) return the chain so they can be chained further.
//   - Terminal awaiters (single/maybeSingle) resolve to `{ data: null, error: null }`.
//
// Callers override whichever methods matter to their call site — most often
// the final terminal (e.g. `{ limit: async () => ({ data, error }) }` when
// the code awaits `limit`, or `{ maybeSingle: async () => ... }` when it
// ends with maybeSingle).

export type ChainOverrides = Record<string, unknown>

export function makeChain<T extends ChainOverrides = ChainOverrides>(
  overrides: T = {} as T
): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  }
  return chain
}

/**
 * Builds a `{ from }` dispatcher for mocking a Supabase client.
 *
 * Pass a route map to return a specific chain per table, or a function for
 * full control. Unknown tables fall back to a default chain (or whatever
 * your function returns).
 */
export function mockSupabaseFrom(routes: Record<string, unknown> | ((table: string) => unknown)): {
  from: ReturnType<typeof vi.fn>
} {
  const impl =
    typeof routes === 'function'
      ? (routes as (table: string) => unknown)
      : (table: string) => routes[table] ?? makeChain()
  return { from: vi.fn(impl) }
}
