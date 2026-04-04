'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canManageOrg, isInternalUser } from '@/lib/permissions'
import { fetchBrandfetch, extractDomain, normalizeBrandData, BrandfetchError } from './client'
import type { BrandData } from './types'

export interface FetchBrandDataResult {
  error?: string
  data?: BrandData
}

export async function fetchBrandData(websiteUrl: string): Promise<FetchBrandDataResult> {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = rawUser
    ? {
        organization_id: membership?.organization_id ?? null,
        role: membership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord || (!isInternalUser(userRecord) && !canManageOrg(userRecord.role))) {
    return { error: 'Only admins can fetch brand data' }
  }

  // Extract domain and fetch
  try {
    const domain = extractDomain(websiteUrl)
    const response = await fetchBrandfetch(domain)
    const data = normalizeBrandData(response)
    return { data }
  } catch (error) {
    console.error('[Brandfetch Error]', {
      type: 'fetch_brand',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })

    if (error instanceof BrandfetchError) {
      if (error.status === 404) {
        return { error: 'No brand data found for this domain' }
      }
      if (error.status === 429) {
        return { error: 'Too many requests. Please wait a moment.' }
      }
    }

    return { error: 'Failed to fetch brand data. Please try again.' }
  }
}

export interface UploadBrandLogoResult {
  error?: string
  logoUrl?: string
}

export async function uploadBrandLogo(
  imageUrl: string,
  format: string,
  organizationId?: string // Optional: for internal users editing other orgs
): Promise<UploadBrandLogoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: rawUploadUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const uploadMembership = (
    rawUploadUser?.team_members as { organization_id: string; role: string }[]
  )?.[0]
  const uploadUserRecord = rawUploadUser
    ? {
        organization_id: uploadMembership?.organization_id ?? null,
        role: uploadMembership?.role ?? 'client_viewer',
        is_internal: rawUploadUser.is_internal,
      }
    : null

  if (
    !uploadUserRecord ||
    (!isInternalUser(uploadUserRecord) && !canManageOrg(uploadUserRecord.role))
  ) {
    return { error: 'Only admins can upload logos' }
  }

  const isInternal = isInternalUser(uploadUserRecord)
  const orgId = isInternal && organizationId ? organizationId : uploadUserRecord.organization_id

  if (!orgId) {
    return { error: 'No organization specified' }
  }

  try {
    // Download image from Brandfetch CDN
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error('Failed to download image')
    }

    const blob = await response.blob()
    const fileExt = format === 'svg' ? 'svg' : format === 'png' ? 'png' : 'jpg'
    const filePath = `${orgId}/logo.${fileExt}`
    const contentType =
      format === 'svg' ? 'image/svg+xml' : format === 'png' ? 'image/png' : 'image/jpeg'

    // Delete existing logo files first
    const { data: existingFiles } = await supabase.storage.from('organization-logos').list(orgId)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${orgId}/${f.name}`)
      await supabase.storage.from('organization-logos').remove(filesToDelete)
    }

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('organization-logos')
      .upload(filePath, blob, {
        upsert: true,
        contentType,
      })

    if (uploadError) {
      throw uploadError
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
      console.error('[Brand Logo Update Error]', {
        error: updateError,
        timestamp: new Date().toISOString(),
      })
      return { error: 'Failed to save logo to organization' }
    }

    revalidatePath('/settings/organization')
    revalidatePath('/dashboard')
    revalidatePath('/organizations')
    revalidatePath('/', 'layout') // Revalidate the authenticated layout to refresh OrgSelector

    return { logoUrl: publicUrl }
  } catch (error) {
    console.error('[Brand Logo Upload Error]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to upload logo' }
  }
}
