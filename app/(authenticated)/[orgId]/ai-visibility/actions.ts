'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { syncOrganization } from '@/lib/ai-visibility/sync'
import { withAdminAuth } from '@/lib/actions/with-auth'
import { revalidatePath } from 'next/cache'

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
