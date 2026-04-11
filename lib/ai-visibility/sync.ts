import { createServiceClient } from '@/lib/supabase/server'
import { getAdapter } from './platforms/registry'
import { PLATFORM_PROVIDER_KEYS, PLATFORM_CREDENTIAL_KEYS } from './platforms/provider-keys'
import { analyzeResponse } from './analyzer'
import { buildOrgContext } from './context'
import { getCurrentMonthSpend, canContinueSync, checkBudgetThresholds } from './budget'
import { sendBudgetAlert } from './alerts'
import { calculateVisibilityScore } from './scorer'
import { logUsage } from '@/lib/app-settings/usage'
import { getAppCredential } from '@/lib/app-settings/credentials'
import { UsageFeature } from '@/lib/enums'
import type { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { AIVisibilityConfig } from './types'

interface SyncInput {
  organizationId: string
  orgName: string
  websiteUrl: string | null
  config: AIVisibilityConfig
}

export interface SyncResult {
  queriesCompleted: number
  totalCostCents: number
  budgetExceeded: boolean
  errors: { promptId: string; platform: string; error: string }[]
  skippedPlatforms: AIPlatform[]
}

/**
 * Sync AI visibility data for a single organization.
 * Queries each prompt on each platform, analyzes responses, stores results, and calculates score.
 */
export async function syncOrganization(input: SyncInput): Promise<SyncResult> {
  const { organizationId, orgName, websiteUrl, config } = input
  const supabase = createServiceClient()

  const result: SyncResult = {
    queriesCompleted: 0,
    totalCostCents: 0,
    budgetExceeded: false,
    errors: [],
    skippedPlatforms: [],
  }

  // Filter to platforms that have credentials configured
  const credentialChecks = await Promise.all(
    config.platforms.map(async (platform) => {
      const credKey = PLATFORM_CREDENTIAL_KEYS[platform]
      const credential = await getAppCredential(credKey)
      return { platform, hasCredential: !!credential }
    })
  )

  const activePlatforms = credentialChecks.filter((c) => c.hasCredential).map((c) => c.platform)
  result.skippedPlatforms = credentialChecks.filter((c) => !c.hasCredential).map((c) => c.platform)

  if (activePlatforms.length === 0) {
    return result
  }

  // Check budget before starting
  const currentSpend = await getCurrentMonthSpend(organizationId)
  if (!canContinueSync(currentSpend, config.monthly_budget_cents)) {
    result.budgetExceeded = true
    return result
  }

  // Fetch active prompts
  const { data: prompts, error: promptsError } = await supabase
    .from('ai_visibility_prompts')
    .select('id, prompt_text')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (promptsError || !prompts?.length) {
    if (promptsError) {
      console.error('[AI Visibility Sync]', {
        type: 'prompts_fetch_failed',
        organizationId,
        error: promptsError.message,
        timestamp: new Date().toISOString(),
      })
    }
    return result
  }

  const orgContext = buildOrgContext({
    orgName,
    websiteUrl,
    competitors: config.competitors,
  })

  let runningSpend = currentSpend
  const allSentiments: BrandSentiment[] = []
  let mentionedCount = 0
  let citedCount = 0
  const platformBreakdown: Record<string, { mentions: number; citations: number }> = {}
  const allCitedUrls = new Set<string>()
  const queriedAt = new Date().toISOString()

  for (const prompt of prompts) {
    if (!canContinueSync(runningSpend, config.monthly_budget_cents)) {
      result.budgetExceeded = true
      break
    }

    const platformResults = await Promise.allSettled(
      activePlatforms.map(async (platform) => {
        try {
          const adapter = getAdapter(platform)
          const response = await adapter.query(prompt.prompt_text)
          const analysis = await analyzeResponse(response, orgContext)

          const queryCost = response.costCents + analysis.sentiment_cost_cents

          return { platform, response, analysis, queryCost }
        } catch (err) {
          throw { platform, error: err }
        }
      })
    )

    for (const settled of platformResults) {
      if (settled.status === 'rejected') {
        const reason = settled.reason as { platform?: string; error?: unknown }
        const errMsg =
          reason.error instanceof Error ? reason.error.message : String(reason.error ?? reason)
        const failedPlatform = (reason.platform ?? 'unknown') as AIPlatform
        result.errors.push({
          promptId: prompt.id,
          platform: failedPlatform,
          error: errMsg,
        })

        // Log the error to usage_logs so it surfaces in system health
        if (failedPlatform !== ('unknown' as AIPlatform)) {
          await logUsage(PLATFORM_PROVIDER_KEYS[failedPlatform], 'ai_visibility_error', {
            organizationId: organizationId,
            feature: UsageFeature.AIVisibility,
            metadata: { error: errMsg, promptId: prompt.id, platform: failedPlatform },
          })
        }
        continue
      }

      const { platform, response, analysis, queryCost } = settled.value

      runningSpend += queryCost
      result.totalCostCents += queryCost
      result.queriesCompleted++

      if (analysis.brand_mentioned) {
        mentionedCount++
        allSentiments.push(analysis.brand_sentiment)
      }
      if (analysis.domain_cited) {
        citedCount++
        analysis.cited_urls.forEach((url) => allCitedUrls.add(url))
      }

      if (!platformBreakdown[platform]) {
        platformBreakdown[platform] = { mentions: 0, citations: 0 }
      }
      if (analysis.brand_mentioned) platformBreakdown[platform].mentions++
      if (analysis.domain_cited) platformBreakdown[platform].citations++

      const { error: insertError } = await supabase.from('ai_visibility_results').insert({
        prompt_id: prompt.id,
        organization_id: organizationId,
        platform,
        response_text: response.text,
        brand_mentioned: analysis.brand_mentioned,
        brand_sentiment: analysis.brand_sentiment,
        brand_position: analysis.brand_position,
        domain_cited: analysis.domain_cited,
        cited_urls: analysis.cited_urls,
        competitor_mentions: analysis.competitor_mentions,
        tokens_used: response.inputTokens + response.outputTokens,
        cost_cents: queryCost,
        queried_at: queriedAt,
        raw_response: null,
      })

      if (insertError) {
        console.error('[AI Visibility Sync]', {
          type: 'result_insert_failed',
          organizationId,
          promptId: prompt.id,
          platform,
          error: insertError.message,
          timestamp: new Date().toISOString(),
        })
      }

      await logUsage(PLATFORM_PROVIDER_KEYS[platform], 'ai_visibility_query', {
        organizationId,
        feature: UsageFeature.AIVisibility,
        tokensInput: response.inputTokens,
        tokensOutput: response.outputTokens,
        cost: queryCost,
        metadata: { promptId: prompt.id, platform },
      })
    }
  }

  if (result.queriesCompleted > 0) {
    const totalPromptPlatformPairs = prompts.length * activePlatforms.length
    const score = calculateVisibilityScore({
      totalPrompts: totalPromptPlatformPairs,
      mentionedCount,
      citedCount,
      sentiments: allSentiments,
    })

    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + 1)

    await supabase.from('ai_visibility_scores').insert({
      organization_id: organizationId,
      score,
      mentions_count: mentionedCount,
      citations_count: citedCount,
      cited_pages_count: allCitedUrls.size,
      platform_breakdown: platformBreakdown,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    })
  }

  await supabase
    .from('ai_visibility_configs')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  const alertType = checkBudgetThresholds({
    currentSpendCents: runningSpend,
    budgetCents: config.monthly_budget_cents,
    thresholdPercent: config.budget_alert_threshold,
    lastAlertType: config.last_alert_type,
  })

  if (alertType) {
    await sendBudgetAlert({
      organizationId,
      orgName,
      alertType,
      currentSpendCents: runningSpend,
      budgetCents: config.monthly_budget_cents,
      thresholdPercent: config.budget_alert_threshold,
    })
  }

  return result
}

/**
 * Run analysis for a single prompt across all active platforms.
 * Used to immediately analyze a newly added prompt without waiting for a full sync.
 */
export async function syncSinglePrompt(input: {
  organizationId: string
  orgName: string
  websiteUrl: string | null
  config: AIVisibilityConfig
  promptId: string
  promptText: string
}): Promise<void> {
  const { organizationId, orgName, websiteUrl, config, promptId, promptText } = input
  const supabase = createServiceClient()

  // Filter to platforms with credentials
  const credentialChecks = await Promise.all(
    config.platforms.map(async (platform) => {
      const credential = await getAppCredential(PLATFORM_CREDENTIAL_KEYS[platform])
      return { platform, hasCredential: !!credential }
    })
  )
  const activePlatforms = credentialChecks.filter((c) => c.hasCredential).map((c) => c.platform)

  if (activePlatforms.length === 0) return

  const orgContext = buildOrgContext({
    orgName,
    websiteUrl,
    competitors: config.competitors,
  })

  const queriedAt = new Date().toISOString()

  await Promise.allSettled(
    activePlatforms.map(async (platform) => {
      try {
        const adapter = getAdapter(platform)
        const response = await adapter.query(promptText)
        const analysis = await analyzeResponse(response, orgContext)
        const queryCost = response.costCents + analysis.sentiment_cost_cents

        await supabase.from('ai_visibility_results').insert({
          prompt_id: promptId,
          organization_id: organizationId,
          platform,
          response_text: response.text,
          brand_mentioned: analysis.brand_mentioned,
          brand_sentiment: analysis.brand_sentiment,
          brand_position: analysis.brand_position,
          domain_cited: analysis.domain_cited,
          cited_urls: analysis.cited_urls,
          competitor_mentions: analysis.competitor_mentions,
          tokens_used: response.inputTokens + response.outputTokens,
          cost_cents: queryCost,
          queried_at: queriedAt,
          raw_response: null,
        })

        await logUsage(PLATFORM_PROVIDER_KEYS[platform], 'ai_visibility_query', {
          organizationId,
          feature: UsageFeature.AIVisibility,
          tokensInput: response.inputTokens,
          tokensOutput: response.outputTokens,
          cost: queryCost,
          metadata: { promptId, platform },
        })
      } catch (error) {
        console.error('[AI Visibility Sync]', {
          type: 'single_prompt_query_failed',
          organizationId,
          promptId,
          platform,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    })
  )
}
