'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { syncOrganization } from '@/lib/ai-visibility/sync'
import { withAdminAuth } from '@/lib/actions/with-auth'
import { revalidatePath } from 'next/cache'
import { PromptSource } from '@/lib/enums'

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

    const { error } = await supabase.from('ai_visibility_prompts').insert({
      topic_id: topicId,
      organization_id: orgId,
      prompt_text: data.promptText.trim(),
      source: PromptSource.Manual,
      is_active: true,
    })

    if (error) {
      return { success: false as const, error: 'Failed to create prompt' }
    }

    revalidatePath(`/${orgId}/ai-visibility/prompts`)
    return { success: true as const }
  })
}
