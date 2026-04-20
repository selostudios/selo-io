import { createServiceClient } from '@/lib/supabase/server'
import { NARRATIVE_BLOCK_KEYS, type NarrativeBlockKey } from './prompts'

export type PromptOverrides = Partial<Record<NarrativeBlockKey, string>>

const BLOCK_KEY_SET = new Set<string>(NARRATIVE_BLOCK_KEYS)

export function filterPromptOverrides(raw: unknown): PromptOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: PromptOverrides = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!BLOCK_KEY_SET.has(key)) continue
    if (typeof value !== 'string') continue
    if (value.length === 0) continue
    result[key as NarrativeBlockKey] = value
  }
  return result
}

export async function loadPromptOverrides(organizationId: string): Promise<PromptOverrides> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('marketing_review_prompt_overrides')
      .select('prompts')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error || !data) return {}
    return filterPromptOverrides(data.prompts)
  } catch (err) {
    console.error('[Prompt Override Load Error]', {
      type: 'lookup_failed',
      organizationId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return {}
  }
}
