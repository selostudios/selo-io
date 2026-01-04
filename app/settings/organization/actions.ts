'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateOrganization(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get('name') as string
  const industryId = formData.get('industry') as string
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
      industry: industryId || null,
      logo_url: logoUrl?.trim() || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userRecord.organization_id)

  if (error) {
    console.error('[Organization Error]', {
      type: 'update_org',
      error,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to update organization settings' }
  }

  revalidatePath('/settings/organization')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function uploadLogo(
  formData: FormData
): Promise<{ error?: string; logoUrl?: string }> {
  const file = formData.get('file') as File

  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  // Validate file size (2MB max)
  const MAX_SIZE = 2 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return { error: 'File size must be less than 2MB' }
  }

  // Validate file type
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'File must be PNG, JPG, or SVG' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    return { error: 'Only admins can upload logos' }
  }

  const orgId = userRecord.organization_id
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
  const filePath = `${orgId}/logo.${fileExt}`

  // Delete existing logo files first (there might be different extensions)
  const { data: existingFiles } = await supabase.storage.from('organization-logos').list(orgId)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map((f) => `${orgId}/${f.name}`)
    await supabase.storage.from('organization-logos').remove(filesToDelete)
  }

  // Upload new logo
  const { error: uploadError } = await supabase.storage
    .from('organization-logos')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('[Logo Upload Error]', {
      error: uploadError,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to upload logo' }
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('organization-logos').getPublicUrl(filePath)

  // Update organization with new logo URL
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', orgId)

  if (updateError) {
    console.error('[Logo Update Error]', {
      error: updateError,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to save logo' }
  }

  revalidatePath('/settings/organization')
  revalidatePath('/dashboard')

  return { logoUrl: publicUrl }
}

export async function removeLogo(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    return { error: 'Only admins can remove logos' }
  }

  const orgId = userRecord.organization_id

  // Delete all logo files for this org
  const { data: existingFiles } = await supabase.storage.from('organization-logos').list(orgId)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map((f) => `${orgId}/${f.name}`)
    await supabase.storage.from('organization-logos').remove(filesToDelete)
  }

  // Clear logo URL from organization
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('id', orgId)

  if (updateError) {
    console.error('[Logo Remove Error]', {
      error: updateError,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to remove logo' }
  }

  revalidatePath('/settings/organization')
  revalidatePath('/dashboard')

  return { success: true }
}
