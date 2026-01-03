'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateOrganization(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get('name') as string
  const industry = formData.get('industry') as string
  const logoUrl = formData.get('logoUrl') as string
  const primaryColor = formData.get('primaryColor') as string
  const secondaryColor = formData.get('secondaryColor') as string
  const accentColor = formData.get('accentColor') as string

  if (!name || name.trim().length === 0) {
    return { error: 'Organization name is required' }
  }

  if (name.length > 100) {
    return { error: 'Organization name must be less than 100 characters' }
  }

  // Validate color format (hex color)
  const hexColorRegex = /^#[0-9A-F]{6}$/i
  if (!hexColorRegex.test(primaryColor)) {
    return { error: 'Primary color must be a valid hex color (e.g., #000000)' }
  }
  if (!hexColorRegex.test(secondaryColor)) {
    return { error: 'Secondary color must be a valid hex color' }
  }
  if (!hexColorRegex.test(accentColor)) {
    return { error: 'Accent color must be a valid hex color' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization and verify they're an admin
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can update organization settings' }
  }

  // Update organization
  const { error } = await supabase
    .from('organizations')
    .update({
      name: name.trim(),
      industry: industry?.trim() || null,
      logo_url: logoUrl?.trim() || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      updated_at: new Date().toISOString()
    })
    .eq('id', userRecord.organization_id)

  if (error) {
    console.error('[Organization Error]', { type: 'update_org', error, timestamp: new Date().toISOString() })
    return { error: 'Failed to update organization settings' }
  }

  revalidatePath('/settings/organization')
  revalidatePath('/dashboard')

  return { success: true }
}
