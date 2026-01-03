'use server'

import { createClient } from '@/lib/supabase/server'
import { generateUTMParameters } from '@/lib/utils/utm'
import { revalidatePath } from 'next/cache'

export async function createCampaign(formData: FormData) {
  const name = formData.get('name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'team_member'].includes(userRecord.role)) {
    return { error: 'Permission denied' }
  }

  // Generate UTM parameters
  const utmParams = generateUTMParameters(name)

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: userRecord.organization_id,
      name,
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'draft',
      ...utmParams,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true, campaign: data }
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  const name = formData.get('name') as string
  const status = formData.get('status') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  const supabase = await createClient()

  const { error } = await supabase
    .from('campaigns')
    .update({
      name,
      status,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .eq('id', campaignId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/campaigns')
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true }
}

export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true }
}
