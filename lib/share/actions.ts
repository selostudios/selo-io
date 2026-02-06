'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { nanoid } from 'nanoid'
import { ShareExpiration, ShareErrorCode, SharedResourceType } from '@/lib/enums'
import { getExpirationDays } from '@/lib/reports/types'
import type {
  SharedLink,
  CreateSharedLinkInput,
  SharedLinkValidation,
  AccessSharedLinkResult,
} from './types'

// Database row type (internal only — includes password_hash)
interface SharedLinkRow {
  id: string
  resource_type: string
  resource_id: string
  token: string
  expires_at: string
  password_hash: string | null
  max_views: number
  view_count: number
  last_viewed_at: string | null
  created_by: string | null
  organization_id: string | null
  created_at: string
}

function toClientSharedLink(row: SharedLinkRow): SharedLink {
  return {
    id: row.id,
    resource_type: row.resource_type as SharedResourceType,
    resource_id: row.resource_id,
    token: row.token,
    expires_at: row.expires_at,
    has_password: row.password_hash !== null,
    max_views: row.max_views,
    view_count: row.view_count,
    last_viewed_at: row.last_viewed_at,
    created_at: row.created_at,
  }
}

function generateShareToken(): string {
  return nanoid(21)
}

function calculateExpirationDate(expiresIn: ShareExpiration, customDate?: string): Date {
  if (expiresIn === ShareExpiration.Custom && customDate) {
    return new Date(customDate)
  }
  const days = getExpirationDays(expiresIn)
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function getRevalidatePath(resourceType: SharedResourceType, resourceId: string): string {
  switch (resourceType) {
    case SharedResourceType.Report:
      return `/seo/reports/${resourceId}`
    case SharedResourceType.SiteAudit:
      return `/seo/site-audit/${resourceId}`
    case SharedResourceType.PerformanceAudit:
      return `/seo/performance/${resourceId}`
    case SharedResourceType.AIOAudit:
      return `/seo/aio/${resourceId}`
  }
}

// ============================================================
// SHARE LINK CREATION
// ============================================================

export interface CreateSharedLinkResult {
  success: boolean
  share?: SharedLink
  shareUrl?: string
  error?: string
}

export async function createSharedLink(
  input: CreateSharedLinkInput
): Promise<CreateSharedLinkResult> {
  const supabase = await createClient()

  // Get current user for created_by and organization_id
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get user's organization_id
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const token = generateShareToken()
  const expiresAt = calculateExpirationDate(input.expires_in, input.custom_expiration)

  // Hash password if provided
  let passwordHash: string | null = null
  if (input.password) {
    const { data: hashResult, error: hashError } = await supabase.rpc('crypt_password', {
      password: input.password,
    })

    if (hashError) {
      const { data: cryptResult, error: hashError2 } = await supabase.rpc('hash_password', {
        password: input.password,
      })

      if (hashError2 || !cryptResult) {
        console.error('[Create Shared Link Error]', {
          type: 'password_hash_failed',
          error: hashError2?.message ?? 'Password hashing unavailable',
          timestamp: new Date().toISOString(),
        })
        return {
          success: false,
          error:
            'Failed to secure share link with password. Please try again without password protection.',
        }
      }
      passwordHash = cryptResult
    } else {
      passwordHash = hashResult
    }
  }

  const { data: share, error } = await supabase
    .from('shared_links')
    .insert({
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      token,
      expires_at: expiresAt.toISOString(),
      password_hash: passwordHash,
      max_views: input.max_views ?? 50,
      created_by: user.id,
      organization_id: userRecord?.organization_id ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Shared Link Error]', {
      type: 'insert_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to create share link' }
  }

  const headersList = await headers()
  const host = headersList.get('host') || ''
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`
  const shareUrl = `${baseUrl}/s/${token}`

  revalidatePath(getRevalidatePath(input.resource_type, input.resource_id))

  return {
    success: true,
    share: toClientSharedLink(share as SharedLinkRow),
    shareUrl,
  }
}

// ============================================================
// SHARE LINK LISTING & MANAGEMENT
// ============================================================

export async function getSharedLinksForResource(
  resourceType: SharedResourceType,
  resourceId: string
): Promise<SharedLink[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('shared_links')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Get Shared Links Error]', {
      type: 'fetch_failed',
      resourceType,
      resourceId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return (data ?? []).map((row) => toClientSharedLink(row as SharedLinkRow))
}

export async function deleteSharedLink(
  shareId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get resource info first for revalidation
  const { data: share } = await supabase
    .from('shared_links')
    .select('resource_type, resource_id')
    .eq('id', shareId)
    .single()

  const { error } = await supabase.from('shared_links').delete().eq('id', shareId)

  if (error) {
    console.error('[Delete Shared Link Error]', {
      type: 'delete_failed',
      shareId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to delete share link' }
  }

  if (share) {
    revalidatePath(getRevalidatePath(share.resource_type as SharedResourceType, share.resource_id))
  }

  return { success: true }
}

// ============================================================
// PUBLIC SHARE ACCESS (uses SECURITY DEFINER functions)
// ============================================================

export async function validateSharedLinkToken(token: string): Promise<SharedLinkValidation> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('validate_shared_link', {
    share_token: token,
  })

  if (error) {
    console.error('[Validate Shared Link Error]', {
      type: 'validation_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return {
      resource_type: null,
      resource_id: null,
      is_valid: false,
      requires_password: false,
      error_code: ShareErrorCode.NotFound,
    }
  }

  const result = data?.[0]
  if (!result) {
    return {
      resource_type: null,
      resource_id: null,
      is_valid: false,
      requires_password: false,
      error_code: ShareErrorCode.NotFound,
    }
  }

  return {
    resource_type: result.resource_type as SharedResourceType | null,
    resource_id: result.resource_id,
    is_valid: result.is_valid,
    requires_password: result.requires_password,
    error_code: result.error_code as ShareErrorCode | null,
  }
}

export async function accessSharedLink(
  token: string,
  password?: string
): Promise<AccessSharedLinkResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('access_shared_link', {
    share_token: token,
    provided_password: password ?? null,
  })

  if (error) {
    console.error('[Access Shared Link Error]', {
      type: 'access_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return {
      success: false,
      errorCode: ShareErrorCode.NotFound,
    }
  }

  const result = data?.[0]
  if (!result) {
    return {
      success: false,
      errorCode: ShareErrorCode.NotFound,
    }
  }

  if (result.error_code) {
    return {
      success: false,
      errorCode: result.error_code as ShareErrorCode,
    }
  }

  return {
    success: true,
    resource_type: result.resource_type as SharedResourceType,
    resource_id: result.resource_id,
  }
}
