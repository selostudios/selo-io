'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'
import type {
  ReportShare,
  CreateShareLinkInput,
  ShareLinkValidation,
  GeneratedReport,
} from '@/lib/reports/types'
import { ShareExpiration, ShareErrorCode } from '@/lib/enums'
import { getExpirationDays } from '@/lib/reports/types'

// Database row type (internal only - includes password_hash)
interface ReportShareRow {
  id: string
  report_id: string
  token: string
  expires_at: string
  password_hash: string | null
  max_views: number
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

/**
 * Transform database row to client-safe ReportShare
 * Never expose password_hash to the client
 */
function toClientShare(row: ReportShareRow): ReportShare {
  return {
    id: row.id,
    report_id: row.report_id,
    token: row.token,
    expires_at: row.expires_at,
    has_password: row.password_hash !== null,
    max_views: row.max_views,
    view_count: row.view_count,
    last_viewed_at: row.last_viewed_at,
    created_at: row.created_at,
  }
}

// ============================================================
// SHARE LINK CREATION
// ============================================================

export interface CreateShareLinkResult {
  success: boolean
  share?: ReportShare
  shareUrl?: string
  error?: string
}

/**
 * Generate a secure share token
 * Uses nanoid for URL-safe random strings
 */
function generateShareToken(): string {
  // 21 characters provides ~126 bits of entropy
  return nanoid(21)
}

/**
 * Calculate expiration date from expiration type
 */
function calculateExpirationDate(expiresIn: ShareExpiration, customDate?: string): Date {
  if (expiresIn === ShareExpiration.Custom && customDate) {
    return new Date(customDate)
  }

  const days = getExpirationDays(expiresIn)
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

/**
 * Create a new share link for a report
 */
export async function createShareLink(input: CreateShareLinkInput): Promise<CreateShareLinkResult> {
  const supabase = await createClient()

  // Generate secure token
  const token = generateShareToken()

  // Calculate expiration
  const expiresAt = calculateExpirationDate(input.expires_in, input.custom_expiration)

  // Hash password if provided (using database function)
  let passwordHash: string | null = null
  if (input.password) {
    const { data: hashResult, error: hashError } = await supabase.rpc('crypt_password', {
      password: input.password,
    })

    if (hashError) {
      // If crypt_password doesn't exist, try hash_password
      const { data: cryptResult, error: hashError2 } = await supabase.rpc('hash_password', {
        password: input.password,
      })

      if (hashError2 || !cryptResult) {
        console.error('[Create Share Link Error]', {
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

  // Insert share link
  const { data: share, error } = await supabase
    .from('report_shares')
    .insert({
      report_id: input.report_id,
      token,
      expires_at: expiresAt.toISOString(),
      password_hash: passwordHash,
      max_views: input.max_views ?? 50,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Share Link Error]', {
      type: 'insert_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to create share link' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const shareUrl = `${baseUrl}/r/${token}`

  revalidatePath(`/seo/reports/${input.report_id}`)
  return {
    success: true,
    share: toClientShare(share as ReportShareRow),
    shareUrl,
  }
}

// ============================================================
// SHARE LINK LISTING & MANAGEMENT
// ============================================================

/**
 * Get all share links for a report
 */
export async function getShareLinksForReport(reportId: string): Promise<ReportShare[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('report_shares')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Get Share Links Error]', {
      type: 'fetch_failed',
      reportId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  // Transform to client-safe format (excludes password_hash)
  return (data ?? []).map((row) => toClientShare(row as ReportShareRow))
}

/**
 * Delete a share link
 */
export async function deleteShareLink(
  shareId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get report_id first for revalidation
  const { data: share } = await supabase
    .from('report_shares')
    .select('report_id')
    .eq('id', shareId)
    .single()

  const { error } = await supabase.from('report_shares').delete().eq('id', shareId)

  if (error) {
    console.error('[Delete Share Link Error]', {
      type: 'delete_failed',
      shareId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to delete share link' }
  }

  if (share?.report_id) {
    revalidatePath(`/seo/reports/${share.report_id}`)
  }
  return { success: true }
}

/**
 * Update share link settings (expiration, max views)
 */
export async function updateShareLink(
  shareId: string,
  updates: {
    expires_at?: string
    max_views?: number
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: share } = await supabase
    .from('report_shares')
    .select('report_id')
    .eq('id', shareId)
    .single()

  const { error } = await supabase.from('report_shares').update(updates).eq('id', shareId)

  if (error) {
    console.error('[Update Share Link Error]', {
      type: 'update_failed',
      shareId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to update share link' }
  }

  if (share?.report_id) {
    revalidatePath(`/seo/reports/${share.report_id}`)
  }
  return { success: true }
}

// ============================================================
// PUBLIC SHARE ACCESS (uses SECURITY DEFINER functions)
// ============================================================

/**
 * Validate a share token (for checking password requirement)
 * This uses the SECURITY DEFINER function to bypass RLS
 */
export async function validateShareToken(token: string): Promise<ShareLinkValidation> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('validate_share_token', {
    share_token: token,
  })

  if (error) {
    console.error('[Validate Share Token Error]', {
      type: 'validation_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return {
      report_id: null,
      is_valid: false,
      requires_password: false,
      error_code: ShareErrorCode.NotFound,
    }
  }

  // The function returns a single row
  const result = data?.[0]
  if (!result) {
    return {
      report_id: null,
      is_valid: false,
      requires_password: false,
      error_code: ShareErrorCode.NotFound,
    }
  }

  return {
    report_id: result.report_id,
    is_valid: result.is_valid,
    requires_password: result.requires_password,
    error_code: result.error_code as ShareErrorCode | null,
  }
}

export interface AccessSharedReportResult {
  success: boolean
  report?: GeneratedReport
  errorCode?: ShareErrorCode
}

/**
 * Access a shared report (validates, checks password, increments view count)
 * This uses the SECURITY DEFINER function to bypass RLS
 */
export async function accessSharedReport(
  token: string,
  password?: string
): Promise<AccessSharedReportResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('access_shared_report', {
    share_token: token,
    provided_password: password ?? null,
  })

  if (error) {
    console.error('[Access Shared Report Error]', {
      type: 'access_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return {
      success: false,
      errorCode: ShareErrorCode.NotFound,
    }
  }

  // The function returns a single row
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
    report: result.report_data as GeneratedReport,
  }
}

// Utility functions moved to @/lib/reports/share-utils.ts
// Import from there for: getShareUrl, formatExpiration, isShareLinkValid
