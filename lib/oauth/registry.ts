// lib/oauth/registry.ts
import { Platform } from './types'
import { OAuthProvider } from './base'
import { LinkedInOAuthProvider } from './providers/linkedin'

const providers = {
  [Platform.LINKEDIN]: LinkedInOAuthProvider,
  // Future providers:
  // [Platform.GOOGLE_ANALYTICS]: GoogleOAuthProvider,
  // [Platform.INSTAGRAM]: MetaOAuthProvider,
  // [Platform.HUBSPOT]: HubSpotOAuthProvider,
} as const

export function getOAuthProvider(platform: Platform): OAuthProvider {
  const ProviderClass = providers[platform as keyof typeof providers]

  if (!ProviderClass) {
    throw new Error(`OAuth provider not found for platform: ${platform}`)
  }

  return new ProviderClass()
}

export function getRedirectUri(platform: Platform): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/oauth/${platform}/callback`
}
