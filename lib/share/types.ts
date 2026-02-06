import { ShareExpiration, ShareErrorCode, SharedResourceType } from '@/lib/enums'

// Re-export for convenience
export { ShareExpiration, ShareErrorCode, SharedResourceType }

export interface SharedLink {
  id: string
  resource_type: SharedResourceType
  resource_id: string
  token: string
  expires_at: string
  has_password: boolean
  max_views: number
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

export interface CreateSharedLinkInput {
  resource_type: SharedResourceType
  resource_id: string
  expires_in: ShareExpiration
  custom_expiration?: string
  password?: string
  max_views?: number
}

export interface SharedLinkValidation {
  resource_type: SharedResourceType | null
  resource_id: string | null
  is_valid: boolean
  requires_password: boolean
  error_code: ShareErrorCode | null
}

export interface AccessSharedLinkResult {
  success: boolean
  resource_type?: SharedResourceType
  resource_id?: string
  errorCode?: ShareErrorCode
}
