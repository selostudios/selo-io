import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentMonthSpend } from './budget'
import { buildOrgContext } from './context'
import { getAdapter } from './platforms/registry'
import { analyzeResponse } from './analyzer'
import { generateInsight } from './insights'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'
import type { AIPlatform } from '@/lib/enums'

export interface PrepareResearchResult {
  researchId: string
  platforms: AIPlatform[]
  budgetWarning: boolean
  monthlySpendCents: number
  monthlyBudgetCents: number
}

/**
 * Prepare a research query: check budget, load config, generate researchId.
 * Returns immediately — actual queries run in the background via API route.
 */
export async function prepareResearch(orgId: string): Promise<PrepareResearchResult> {
  const supabase = createServiceClient()

  // Load config
  const { data: config } = await supabase
    .from('ai_visibility_configs')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!config) {
    throw new Error('AI Visibility not configured for this organization')
  }

  // Check budget
  const monthlySpendCents = await getCurrentMonthSpend(orgId)
  const budgetWarning =
    config.monthly_budget_cents > 0 && monthlySpendCents >= config.monthly_budget_cents

  return {
    researchId: crypto.randomUUID(),
    platforms: config.platforms as AIPlatform[],
    budgetWarning,
    monthlySpendCents,
    monthlyBudgetCents: config.monthly_budget_cents,
  }
}

/**
 * Execute research queries for all platforms in parallel.
 * Called from the API route background via after().
 * Each result is stored individually as it completes.
 */
export async function executeResearch(
  orgId: string,
  researchId: string,
  promptText: string,
  platforms: AIPlatform[],
  websiteUrl: string | null,
  orgName: string,
  competitors: { name: string; domain: string }[]
): Promise<void> {
  const supabase = createServiceClient()
  const orgContext = buildOrgContext({ orgName, websiteUrl, competitors })
  const queriedAt = new Date().toISOString()

  await Promise.allSettled(
    platforms.map(async (platform) => {
      try {
        const adapter = getAdapter(platform)
        const response = await adapter.query(promptText)
        const analysis = await analyzeResponse(response, orgContext)

        // Generate insight
        const insightResult = await generateInsight(response.text, analysis, orgContext)

        // Calculate cost
        const queryCost =
          response.costCents + analysis.sentiment_cost_cents + (insightResult?.costCents ?? 0)

        // Store result
        const { error: insertError } = await supabase.from('ai_visibility_results').insert({
          organization_id: orgId,
          prompt_id: null,
          research_id: researchId,
          source: 'research',
          platform,
          response_text: response.text,
          brand_mentioned: analysis.brand_mentioned,
          brand_sentiment: analysis.brand_sentiment,
          brand_position: analysis.brand_position,
          domain_cited: analysis.domain_cited,
          cited_urls: analysis.cited_urls,
          competitor_mentions: analysis.competitor_mentions,
          insight: insightResult?.insight ?? null,
          tokens_used: response.inputTokens + response.outputTokens,
          cost_cents: queryCost,
          queried_at: queriedAt,
          raw_response: null,
        })

        if (insertError) {
          console.error('[AI Visibility Research Error]', {
            type: 'result_insert_failed',
            platform,
            researchId,
            error: insertError.message,
            timestamp: new Date().toISOString(),
          })
          return
        }

        // Log usage
        await logUsage(platform === 'chatgpt' ? 'openai' : platform, 'research_query', {
          organizationId: orgId,
          feature: UsageFeature.AIVisibility,
          tokensInput: response.inputTokens,
          tokensOutput: response.outputTokens,
          cost: queryCost,
          metadata: { platform, researchId, promptText: promptText.slice(0, 100) },
        })
      } catch (error) {
        console.error('[AI Visibility Research Error]', {
          type: 'platform_query_failed',
          platform,
          researchId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    })
  )
}

/**
 * Fetch research results by researchId.
 * Returns results that have arrived so far (for progressive polling).
 */
export async function getResearchResults(researchId: string): Promise<ResearchResult[]> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('ai_visibility_results')
    .select('*')
    .eq('research_id', researchId)
    .order('created_at', { ascending: true })

  return (data ?? []) as ResearchResult[]
}

export interface ResearchResult {
  id: string
  platform: AIPlatform
  response_text: string
  brand_mentioned: boolean
  brand_sentiment: string
  brand_position: number | null
  domain_cited: boolean
  cited_urls: string[]
  competitor_mentions: { name: string; mentioned: boolean; cited: boolean }[] | null
  insight: string | null
  cost_cents: number | null
  queried_at: string
}
