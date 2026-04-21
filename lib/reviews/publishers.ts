import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves a set of user IDs to display names.
 *
 * Used by the performance-review snapshot pages to render "Published by
 * {name}" metadata. Both the snapshots list (many publishers) and the single
 * snapshot detail (one publisher) route through this helper so there is a
 * single canonical resolver — no N+1 queries, no duplicated name-formatting
 * logic.
 *
 * Keeps the return shape intentionally narrow: a `Map<userId, string>` where
 * the string is already the display name. Users with no readable name (RLS
 * hid the row, or both first_name and last_name are null/empty) are omitted
 * from the map rather than mapped to `null`, so callers can use
 * `map.get(id) ?? '—'` without extra checks.
 */
export async function resolvePublisherNames(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = Array.from(new Set(userIds.filter((id): id is string => !!id)))
  if (unique.length === 0) return names

  const { data } = await supabase.from('users').select('id, first_name, last_name').in('id', unique)

  if (!data) return names

  for (const row of data as Array<{
    id: string
    first_name: string | null
    last_name: string | null
  }>) {
    const first = (row.first_name ?? '').trim()
    const last = (row.last_name ?? '').trim()
    const full = `${first} ${last}`.trim()
    if (full.length > 0) {
      names.set(row.id, full)
    }
  }

  return names
}
