import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Paginate a Supabase query to overcome the 1000 row limit.
 * Returns all matching rows by fetching in pages.
 */
export async function paginateQuery<T>(
  buildQuery: (
    supabase: SupabaseClient,
    range: { from: number; to: number }
  ) => ReturnType<ReturnType<SupabaseClient['from']>['select']>,
  supabase: SupabaseClient,
  pageSize: number = 1000
): Promise<T[]> {
  const allResults: T[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await buildQuery(supabase, {
      from: offset,
      to: offset + pageSize - 1,
    })

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      allResults.push(...(data as T[]))
      offset += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allResults
}
