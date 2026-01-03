export type PlatformType = 'hubspot' | 'google_analytics' | 'linkedin' | 'meta' | 'instagram'

export type PlatformCredentials = {
  hubspot: {
    api_key: string
  }
  google_analytics: {
    property_id: string
    credentials: object // Service account JSON
  }
  linkedin: {
    access_token: string
    organization_id: string
  }
  meta: {
    access_token: string
    page_id: string
  }
  instagram: {
    access_token: string
    account_id: string
  }
}

export type PlatformConnection = {
  id: string
  organization_id: string
  platform_type: PlatformType
  status: string
  last_sync_at: string | null
  created_at: string
}
