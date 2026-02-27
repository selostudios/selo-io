import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CampaignStatus } from '@/lib/enums'

export { CampaignStatus }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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

/**
 * Formats a duration in milliseconds to a human-readable string.
 * e.g., 142000 -> "2:22s"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const paddedSeconds = seconds.toString().padStart(2, '0')

  if (totalMinutes === 0) {
    return `${seconds}s`
  }

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const paddedMinutes = minutes.toString().padStart(2, '0')
    return `${hours}:${paddedMinutes}:${paddedSeconds}s`
  }

  return `${totalMinutes}:${paddedSeconds}s`
}

/**
 * Calculates duration between two ISO date strings.
 * Returns null if either date is missing.
 */
export function calculateDuration(
  startedAt: string | null,
  completedAt: string | null
): number | null {
  if (!startedAt || !completedAt) return null
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  return end - start
}

/**
 * Extracts the hostname from a URL string.
 * Returns the original string if parsing fails, or a fallback for nullish values.
 */
export function getDomain(url: string | null | undefined, fallback = ''): string {
  if (!url) return fallback
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Formats an ISO date string for audit display (e.g., "Feb 27, 2026").
 */
export function formatAuditDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
