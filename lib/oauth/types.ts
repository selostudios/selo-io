// lib/oauth/types.ts

export enum Platform {
  LINKEDIN = 'linkedin',
  GOOGLE_ANALYTICS = 'google_analytics',
  INSTAGRAM = 'instagram',
  HUBSPOT = 'hubspot',
  META = 'meta',
}

export type PlatformType = `${Platform}`

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds
  scopes?: string[]
}

export interface Account {
  id: string
  name: string
}

export interface OAuthCredentials {
  access_token: string
  refresh_token: string
  expires_at: string // ISO 8601
  organization_id: string
  organization_name: string
  scopes: string[]
}
