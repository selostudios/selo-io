import { ShareErrorCode, SharedResourceType } from '@/lib/enums'
import type { SharedLink } from './types'

export function getShareUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return `${baseUrl}/s/${token}`
}

export function formatExpiration(expiresAt: string): string {
  const date = new Date(expiresAt)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Expired'
  if (diffDays === 0) return 'Expires today'
  if (diffDays === 1) return 'Expires tomorrow'
  if (diffDays <= 7) return `Expires in ${diffDays} days`
  return `Expires ${date.toLocaleDateString()}`
}

export function isShareLinkValid(share: SharedLink): boolean {
  const now = new Date()
  const expiresAt = new Date(share.expires_at)
  if (expiresAt < now) return false
  if (share.view_count >= share.max_views) return false
  return true
}

export function getResourceTypeLabel(type: SharedResourceType): string {
  switch (type) {
    case SharedResourceType.Report:
      return 'Report'
    case SharedResourceType.SiteAudit:
      return 'Site Audit'
    case SharedResourceType.PerformanceAudit:
      return 'Performance Audit'
    case SharedResourceType.AIOAudit:
      return 'AIO Audit'
  }
}

export function getShareErrorMessage(error: ShareErrorCode): string {
  switch (error) {
    case ShareErrorCode.NotFound:
      return 'This link does not exist.'
    case ShareErrorCode.Expired:
      return 'This link has expired.'
    case ShareErrorCode.ViewLimitExceeded:
      return 'This link has reached its view limit.'
    case ShareErrorCode.PasswordRequired:
      return 'This resource requires a password.'
    case ShareErrorCode.InvalidPassword:
      return 'Incorrect password.'
    case ShareErrorCode.ReportNotFound:
      return 'The report could not be found.'
    case ShareErrorCode.ResourceNotFound:
      return 'The shared resource could not be found.'
  }
}
