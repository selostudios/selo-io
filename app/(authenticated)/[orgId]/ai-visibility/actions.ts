'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { syncOrganization } from '@/lib/ai-visibility/sync'
import { withAdminAuth } from '@/lib/actions/with-auth'
import { revalidatePath } from 'next/cache'
import { PromptSource, AIPlatform, SyncFrequency } from '@/lib/enums'

export async function runAIVisibilitySync(orgId: string) {
  return withAdminAuth(async () => {
    const supabase = createServiceClient()

    // Fetch config
    const { data: config, error: configError } = await supabase
      .from('ai_visibility_configs')
      .select('*')
      .eq('organization_id', orgId)
      .single()

    if (configError || !config) {
      return {
        success: false as const,
        error: 'AI Visibility not configured for this organization',
      }
    }

    if (!config.is_active) {
      return { success: false as const, error: 'AI Visibility is not active' }
    }

    // Fetch org data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, website_url')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return { success: false as const, error: 'Organization not found' }
    }

    const result = await syncOrganization({
      organizationId: orgId,
      orgName: org.name,
      websiteUrl: org.website_url,
      config,
    })

    revalidatePath(`/${orgId}/ai-visibility`)

    return {
      success: true as const,
      queriesCompleted: result.queriesCompleted,
      totalCostCents: result.totalCostCents,
      budgetExceeded: result.budgetExceeded,
      errors: result.errors.length,
    }
  })
}

export async function addPrompt(
  orgId: string,
  data: { topicName: string; topicId?: string; promptText: string }
) {
  return withAdminAuth(async () => {
    const supabase = createServiceClient()

    let topicId = data.topicId

    if (!topicId) {
      if (!data.topicName.trim()) {
        return { success: false as const, error: 'Topic name is required' }
      }

      const { data: topic, error } = await supabase
        .from('ai_visibility_topics')
        .insert({
          organization_id: orgId,
          name: data.topicName.trim(),
          source: PromptSource.Manual,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        return { success: false as const, error: 'Failed to create topic' }
      }
      topicId = topic.id
    }

    const { data: prompt, error } = await supabase
      .from('ai_visibility_prompts')
      .insert({
        topic_id: topicId,
        organization_id: orgId,
        prompt_text: data.promptText.trim(),
        source: PromptSource.Manual,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      return { success: false as const, error: 'Failed to create prompt' }
    }

    revalidatePath(`/${orgId}/ai-visibility/prompts`)
    return { success: true as const, promptId: prompt.id as string }
  })
}

export async function linkResearchResultsToPrompt(
  orgId: string,
  researchId: string,
  promptId: string
) {
  return withAdminAuth(async () => {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('ai_visibility_results')
      .update({ prompt_id: promptId })
      .eq('research_id', researchId)
      .eq('organization_id', orgId)

    if (error) {
      return { success: false as const, error: 'Failed to link results' }
    }

    revalidatePath(`/${orgId}/ai-visibility/prompts`)
    return { success: true as const }
  })
}

export async function getResearchPageData(orgId: string) {
  const supabase = createServiceClient()

  const [configResult, orgResult] = await Promise.all([
    supabase.from('ai_visibility_configs').select('*').eq('organization_id', orgId).maybeSingle(),
    supabase.from('organizations').select('name, website_url').eq('id', orgId).single(),
  ])

  const config = configResult.data
  const org = orgResult.data

  if (!config || !org) return null

  const { getCurrentMonthSpend } = await import('@/lib/ai-visibility/budget')
  const monthlySpendCents = await getCurrentMonthSpend(orgId)

  return {
    orgName: org.name,
    websiteUrl: org.website_url,
    competitors: config.competitors as { name: string; domain: string }[],
    monthlySpendCents,
    monthlyBudgetCents: config.monthly_budget_cents,
    isActive: config.is_active,
  }
}

export async function updateAIVisibilityConfig(
  orgId: string,
  data: {
    isActive: boolean
    platforms: AIPlatform[]
    syncFrequency: SyncFrequency
    monthlyBudgetCents: number
    budgetAlertThreshold: number
    competitors: { name: string; domain: string }[]
  }
) {
  return withAdminAuth(async () => {
    if (data.isActive && data.platforms.length === 0) {
      return { success: false as const, error: 'Select at least one platform when active' }
    }
    if (data.monthlyBudgetCents < 100) {
      return { success: false as const, error: 'Minimum budget is $1.00' }
    }
    if (data.budgetAlertThreshold < 50 || data.budgetAlertThreshold > 100) {
      return { success: false as const, error: 'Alert threshold must be between 50% and 100%' }
    }
    if (data.competitors.length > 10) {
      return { success: false as const, error: 'Maximum 10 competitors allowed' }
    }

    const supabase = createServiceClient()

    const { error } = await supabase.from('ai_visibility_configs').upsert(
      {
        organization_id: orgId,
        is_active: data.isActive,
        platforms: data.platforms,
        sync_frequency: data.syncFrequency,
        monthly_budget_cents: data.monthlyBudgetCents,
        budget_alert_threshold: data.budgetAlertThreshold,
        competitors: data.competitors,
      },
      { onConflict: 'organization_id' }
    )

    if (error) {
      console.error('[AI Visibility Config]', {
        type: 'update_failed',
        organizationId: orgId,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
      return { success: false as const, error: 'Failed to save configuration' }
    }

    revalidatePath(`/${orgId}/settings/organization`)
    revalidatePath(`/${orgId}/ai-visibility`)
    return { success: true as const }
  })
}
