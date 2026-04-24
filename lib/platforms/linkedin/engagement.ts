export interface EngagementInput {
  reactions?: number
  comments?: number
  shares?: number
  impressions: number
}

export function computeEngagementRate(input: EngagementInput): number | null {
  if (!input.impressions || input.impressions <= 0) return null
  const engagements = (input.reactions ?? 0) + (input.comments ?? 0) + (input.shares ?? 0)
  return engagements / input.impressions
}
