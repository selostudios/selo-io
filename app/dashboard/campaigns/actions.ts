'use server'

import { createClient } from '@/lib/supabase/server'
import { generateUTMParameters } from '@/lib/utils/utm'
import { revalidatePath } from 'next/cache'

const VALID_CAMPAIGN_TYPES = [
  'thought_leadership',
  'product_launch',
  'brand_awareness',
  'lead_generation',
  'event_promotion',
  'seasonal',
  'other',
] as const

export async function createCampaign(formData: FormData) {
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const type = formData.get('type') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  // Input validation
  if (!name || name.trim().length === 0) {
    return { error: 'Campaign name is required' }
  }

  if (name.length > 100) {
    return { error: 'Campaign name must be less than 100 characters' }
  }

  if (description && description.length > 500) {
    return { error: 'Description must be less than 500 characters' }
  }

  if (type && !VALID_CAMPAIGN_TYPES.includes(type as (typeof VALID_CAMPAIGN_TYPES)[number])) {
    return { error: 'Invalid campaign type' }
  }

  // Validate date range if both dates provided
  if (start_date && end_date) {
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (end < start) {
      return { error: 'End date must be after start date' }
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    console.error('[Create Campaign Error]', {
      type: 'unauthorized',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: "You don't have permission to create campaigns" }
  }

  // Generate UTM parameters
  const utmParams = generateUTMParameters(name)

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: userRecord.organization_id,
      name,
      description: description?.trim() || null,
      type: type || 'other',
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'draft',
      ...utmParams,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Campaign Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to create campaign. Please try again.' }
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true, campaign: data }
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  const name = formData.get('name') as string
  const status = formData.get('status') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  // Input validation
  if (name && name.trim().length === 0) {
    return { error: 'Campaign name cannot be empty' }
  }

  if (name && name.length > 100) {
    return { error: 'Campaign name must be less than 100 characters' }
  }

  // Validate date range if both dates provided
  if (start_date && end_date) {
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (end < start) {
      return { error: 'End date must be after start date' }
    }
  }

  // Validate status
  const validStatuses = ['draft', 'active', 'completed']
  if (status && !validStatuses.includes(status)) {
    return { error: 'Invalid campaign status' }
  }

  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Authorization check - get user's organization and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    console.error('[Update Campaign Error]', {
      type: 'unauthorized',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: "You don't have permission to update campaigns" }
  }

  // Update campaign (RLS + explicit org filter for defense in depth)
  const { error } = await supabase
    .from('campaigns')
    .update({
      name,
      status,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .eq('id', campaignId)
    .eq('organization_id', userRecord.organization_id) // Ensure campaign belongs to user's org

  if (error) {
    console.error('[Update Campaign Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to update campaign. Please try again.' }
  }

  revalidatePath('/dashboard/campaigns')
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true }
}

export async function updateCampaignDescription(campaignId: string, description: string) {
  if (description && description.length > 500) {
    return { error: 'Description must be less than 500 characters' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    return { error: "You don't have permission to update campaigns" }
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ description: description?.trim() || null })
    .eq('id', campaignId)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    return { error: 'Failed to update description' }
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true }
}

export async function updateUtmMedium(campaignId: string, medium: string) {
  const validMediums = ['email', 'social', 'cpc', 'display', 'referral', 'organic']
  if (!validMediums.includes(medium)) {
    return { error: 'Invalid medium type' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    return { error: "You don't have permission to update campaigns" }
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ utm_medium: medium })
    .eq('id', campaignId)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    return { error: 'Failed to update medium' }
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true }
}

export async function updateUtmParameters(
  campaignId: string,
  params: {
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_term: string
    utm_content: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    return { error: "You don't have permission to update campaigns" }
  }

  const { error } = await supabase
    .from('campaigns')
    .update({
      utm_source: params.utm_source || null,
      utm_medium: params.utm_medium || null,
      utm_campaign: params.utm_campaign || null,
      utm_term: params.utm_term || null,
      utm_content: params.utm_content || null,
    })
    .eq('id', campaignId)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    return { error: 'Failed to update UTM parameters' }
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true }
}

export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Authorization check - get user's organization and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    console.error('[Delete Campaign Error]', {
      type: 'unauthorized',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: "You don't have permission to delete campaigns" }
  }

  // Delete campaign (RLS + explicit org filter for defense in depth)
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('organization_id', userRecord.organization_id) // Ensure campaign belongs to user's org

  if (error) {
    console.error('[Delete Campaign Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to delete campaign. Please try again.' }
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true }
}
