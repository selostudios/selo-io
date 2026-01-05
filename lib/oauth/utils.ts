import { Platform } from './types'

export function getPlatformDisplayName(platform: Platform | string): string {
  const displayNames: Record<Platform, string> = {
    [Platform.LINKEDIN]: 'LinkedIn',
    [Platform.GOOGLE_ANALYTICS]: 'Google Analytics',
    [Platform.INSTAGRAM]: 'Instagram',
    [Platform.META]: 'Meta',
    [Platform.HUBSPOT]: 'HubSpot',
  }

  return displayNames[platform as Platform] || platform
}
