import { createServiceClient } from '@/lib/supabase/server'

// Re-export the pure, client-safe helpers so existing server-side callers
// that import both the loader and the shared helpers from this module keep
// working. Client components (e.g. the settings StyleMemoCard) should import
// from `./style-memo-shared` directly to avoid pulling the service client
// (which depends on `next/headers`) into the browser bundle.
export {
  MAX_MEMO_CHARS,
  truncateMemo,
  buildLearnerDiff,
  type LearnerDiff,
  type BuildLearnerDiffInput,
} from './style-memo-shared'

/**
 * Loads the style memo for an organization. Returns an empty string when no
 * row exists or the lookup fails — the prompt pipeline treats empty memos as
 * "no learned style yet" and omits the section entirely.
 *
 * Uses the service client because this runs inside the narrative generator
 * which executes without a user session (e.g. background learning passes).
 */
export async function loadStyleMemo(organizationId: string): Promise<string> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('marketing_review_style_memos')
      .select('memo')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error || !data) return ''
    const memo = data.memo as string | null
    return memo ?? ''
  } catch (err) {
    console.error('[Style Memo Load Error]', {
      type: 'lookup_failed',
      organizationId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return ''
  }
}
