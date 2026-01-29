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
function calculateExpirationDate(
  expiresIn: ShareExpiration,
  customDate?: string
): Date {
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
export async function createShareLink(
  input: CreateShareLinkInput
): Promise<CreateShareLinkResult> {
  const supabase = await createClient()

  // Generate secure token
  const token = generateShareToken()

  // Calculate expiration
  const expiresAt = calculateExpirationDate(
    input.expires_in,
    input.custom_expiration
  )

  // Hash password if provided (using database function)
  let passwordHash: string | null = null
  if (input.password) {
    const { data: hashResult, error: hashError } = await supabase.rpc(
      'crypt_password',
      { password: input.password }
    )

    if (hashError) {
      // If the function doesn't exist, we need to create it or handle differently
      // For now, we'll use a simple approach via SQL
      const { data: cryptResult } = await supabase.rpc('hash_password', {
        password: input.password,
      })
      passwordHash = cryptResult
    } else {
      passwordHash = hashResult
    }

    // Fallback: if neither works, store raw (not recommended for production)
    // In production, we should ensure pgcrypto is available
    if (!passwordHash && input.password) {
      // Use the crypt function directly in an insert
      const { data: share, error } = await supabase
        .from('report_shares')
        .insert({
          report_id: input.report_id,
          token,
          expires_at: expiresAt.toISOString(),
          password_hash: null, // Will be set via raw SQL
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

      // Update with password hash using raw SQL
      if (input.password) {
        await supabase.rpc('set_share_password', {
          share_id: share.id,
          password: input.password,
        })
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const shareUrl = `${baseUrl}/r/${token}`

      revalidatePath(`/seo/reports/${input.report_id}`)
      return {
        success: true,
        share: share as ReportShare,
        shareUrl,
      }
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
    share: share as ReportShare,
    shareUrl,
  }
}

// ============================================================
// SHARE LINK LISTING & MANAGEMENT
// ============================================================

/**
 * Get all share links for a report
 */
export async function getShareLinksForReport(
  reportId: string
): Promise<ReportShare[]> {
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

  return (data ?? []) as ReportShare[]
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

  const { error } = await supabase
    .from('report_shares')
    .delete()
    .eq('id', shareId)

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

  const { error } = await supabase
    .from('report_shares')
    .update(updates)
    .eq('id', shareId)

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
export async function validateShareToken(
  token: string
): Promise<ShareLinkValidation> {
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

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get share URL from token
 */
export function getShareUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return `${baseUrl}/r/${token}`
}

/**
 * Format expiration date for display
 */
export function formatExpiration(expiresAt: string): string {
  const date = new Date(expiresAt)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return 'Expired'
  }
  if (diffDays === 0) {
    return 'Expires today'
  }
  if (diffDays === 1) {
    return 'Expires tomorrow'
  }
  if (diffDays <= 7) {
    return `Expires in ${diffDays} days`
  }
  return `Expires ${date.toLocaleDateString()}`
}

/**
 * Check if a share link is still valid
 */
export function isShareLinkValid(share: ReportShare): boolean {
  const now = new Date()
  const expiresAt = new Date(share.expires_at)

  if (expiresAt < now) return false
  if (share.view_count >= share.max_views) return false

  return true
}
