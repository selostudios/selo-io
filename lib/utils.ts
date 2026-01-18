import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CampaignStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  COMPLETED: 'completed',
} as const

export type CampaignStatusType = (typeof CampaignStatus)[keyof typeof CampaignStatus]

/**
 * Converts a snake_case role string to a capitalized display name.
 * e.g., "team_member" -> "Team Member"
 */
export function displayName(role: string): string {
  return role
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatDate(dateString: string, includeTime = true): string {
  const date = new Date(dateString)

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' })
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const year = date.getFullYear()

  // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const ordinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  if (!includeTime) {
    return `${dayOfWeek}, ${ordinalSuffix(day)} ${month}, ${year}`
  }

  // Get time in 12-hour format
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 || 12

  return `${dayOfWeek}, ${ordinalSuffix(day)} ${month}, ${year} at ${hours}:${minutes}${ampm}`
}
