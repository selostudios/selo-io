import type { ReportShare } from '@/lib/reports/types'

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
