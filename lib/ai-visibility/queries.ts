import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AIVisibilityScore,
  AIVisibilityConfig,
  AIVisibilityTopic,
  AIVisibilityPrompt,
  AIVisibilityResult,
} from './types'

// =============================================================================
// Exported Types
// =============================================================================

export interface ScoreHistoryPoint {
  score: number
  mentions_count: number
  citations_count: number
  cited_pages_count: number
  created_at: string
}

export interface PromptWithResults extends AIVisibilityPrompt {
  results: AIVisibilityResult[]
}

export interface TopicWithPrompts extends AIVisibilityTopic {
  prompts: PromptWithResults[]
}

export interface MentionFilters {
  platform?: string
  sentiment?: string
  days?: number
  search?: string
}

export interface MentionResult extends AIVisibilityResult {
  prompt_text: string
}

// =============================================================================
// Pure Transformation Helpers (exported for testing)
// =============================================================================

export function groupResultsByPromptId(
  results: AIVisibilityResult[]
): Map<string, AIVisibilityResult[]> {
  const map = new Map<string, AIVisibilityResult[]>()
  for (const result of results) {
    if (!result.prompt_id) continue
    if (!map.has(result.prompt_id)) map.set(result.prompt_id, [])
    map.get(result.prompt_id)!.push(result)
  }
  return map
}

export function assembleTopicsWithPrompts(
  topics: AIVisibilityTopic[],
  prompts: AIVisibilityPrompt[],
  resultsByPrompt: Map<string, AIVisibilityResult[]>
): TopicWithPrompts[] {
  return topics.map((topic) => ({
    ...topic,
    prompts: prompts
      .filter((p) => p.topic_id === topic.id)
      .map((prompt) => ({
        ...prompt,
        results: resultsByPrompt.get(prompt.id) ?? [],
      })),
  }))
}

// =============================================================================
// Server-Side Query Functions
// =============================================================================

export async function getLatestScores(
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  latest: AIVisibilityScore | null
  previous: AIVisibilityScore | null
}> {
  const { data } = await supabase
    .from('ai_visibility_scores')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(2)

  return {
    latest: data?.[0] ?? null,
    previous: data?.[1] ?? null,
  }
}

export async function getScoreHistory(
  supabase: SupabaseClient,
  orgId: string,
  limit = 10
): Promise<ScoreHistoryPoint[]> {
  const { data } = await supabase
    .from('ai_visibility_scores')
    .select('score, mentions_count, citations_count, cited_pages_count, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(limit)

  return data ?? []
}

export async function getAIVisibilityConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<AIVisibilityConfig | null> {
  const { data } = await supabase
    .from('ai_visibility_configs')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  return data
}

export async function getTopicsWithPrompts(
  supabase: SupabaseClient,
  orgId: string
): Promise<TopicWithPrompts[]> {
  // Query 1: topics with their prompts via join
  const { data: topics } = await supabase
    .from('ai_visibility_topics')
    .select('*, ai_visibility_prompts(*)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('ai_visibility_prompts.is_active', true)
    .order('name')

  if (!topics?.length) return []

  // Extract prompts from joined data
  const allPrompts = topics.flatMap(
    (t) =>
      ((t.ai_visibility_prompts as unknown[]) ?? []) as {
        id: string
        prompt_text: string
        created_at: string
      }[]
  )

  if (allPrompts.length === 0) {
    return topics.map((t) => ({
      ...t,
      prompts: [],
    }))
  }

  // Query 2: latest results for all prompts
  const promptIds = allPrompts.map((p) => p.id)
  const { data: latestResult } = await supabase
    .from('ai_visibility_results')
    .select('queried_at')
    .eq('organization_id', orgId)
    .eq('source', 'sync')
    .in('prompt_id', promptIds)
    .order('queried_at', { ascending: false })
    .limit(1)

  let resultsByPrompt = new Map<string, AIVisibilityResult[]>()

  if (latestResult?.length) {
    const { data: results } = await supabase
      .from('ai_visibility_results')
      .select('*')
      .eq('organization_id', orgId)
      .eq('queried_at', latestResult[0].queried_at)

    resultsByPrompt = groupResultsByPromptId(results ?? [])
  }

  return topics.map((t) => {
    const topicPrompts = ((t.ai_visibility_prompts as unknown[]) ?? []) as {
      id: string
      prompt_text: string
      created_at: string
      is_active: boolean
      topic_id: string
      organization_id: string
    }[]
    return {
      ...t,
      prompts: topicPrompts
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((p) => ({
          ...p,
          results: resultsByPrompt.get(p.id) ?? [],
        })),
    }
  })
}

export interface MentionsPage {
  mentions: MentionResult[]
  hasMore: boolean
}

export async function getMentions(
  supabase: SupabaseClient,
  orgId: string,
  filters: MentionFilters = {},
  cursor?: string
): Promise<MentionsPage> {
  const PAGE_SIZE = 50

  let query = supabase
    .from('ai_visibility_results')
    .select('*, ai_visibility_prompts!inner(prompt_text)')
    .eq('organization_id', orgId)
    .eq('brand_mentioned', true)
    .order('queried_at', { ascending: false })
    .limit(PAGE_SIZE + 1) // Fetch one extra to detect hasMore

  if (cursor) {
    query = query.lt('queried_at', cursor)
  }

  if (filters.platform) {
    query = query.eq('platform', filters.platform)
  }
  if (filters.sentiment) {
    query = query.eq('brand_sentiment', filters.sentiment)
  }
  if (filters.days) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filters.days)
    query = query.gte('queried_at', cutoff.toISOString())
  }
  if (filters.search) {
    query = query.ilike('response_text', `%${filters.search}%`)
  }

  const { data } = await query

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  return {
    mentions: page.map((row) => ({
      ...row,
      prompt_text: (row.ai_visibility_prompts as unknown as { prompt_text: string }).prompt_text,
    })),
    hasMore,
  }
}
