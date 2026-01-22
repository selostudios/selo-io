'use server'

import { createClient } from '@/lib/supabase/server'
import { canManageOrg } from '@/lib/permissions'
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

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageOrg(userRecord.role)) {
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
  format: string
): Promise<UploadBrandLogoResult> {
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

  if (!userRecord || !canManageOrg(userRecord.role)) {
    return { error: 'Only admins can upload logos' }
  }

  try {
    // Download image from Brandfetch CDN
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error('Failed to download image')
    }

    const blob = await response.blob()
    const orgId = userRecord.organization_id
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

    return { logoUrl: publicUrl }
  } catch (error) {
    console.error('[Brand Logo Upload Error]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to upload logo' }
  }
}
