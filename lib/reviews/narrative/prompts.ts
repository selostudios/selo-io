import type { SnapshotData } from '@/lib/reviews/types'
import { buildPromptContextPayload } from './context'

export interface PromptContext {
  organizationName: string
  quarter: string
  periodStart: string
  periodEnd: string
  data: SnapshotData
}

const FOOTER =
  'Plain text only. No markdown, asterisks, or hashes. Warm, confident, consultative tone.'

function header(ctx: PromptContext): string {
  return [
    `Organization: ${ctx.organizationName}`,
    `Quarter: ${ctx.quarter} (${ctx.periodStart} → ${ctx.periodEnd})`,
    'Data (current / qoq / yoy / qoq_delta_pct / yoy_delta_pct; nulls mean missing):',
    JSON.stringify(buildPromptContextPayload(ctx.data)),
  ].join('\n')
}

function wrap(ctx: PromptContext, body: string): string {
  return `${header(ctx)}\n\n${body}\n\n${FOOTER}`
}

export function coverSubtitlePrompt(ctx: PromptContext): string {
  return wrap(
    ctx,
    [
      'Write a cover subtitle for the quarterly performance report.',
      'One sentence, 20 words or fewer, capturing the quarter’s headline story.',
      'Lead with the single most notable delta across GA, LinkedIn, HubSpot, email, or audit — whichever moved most.',
    ].join(' ')
  )
}

export function gaSummaryPrompt(ctx: PromptContext): string {
  return wrap(
    ctx,
    [
      'Write a Google Analytics summary for this quarter.',
      '120 words or fewer. Narrate sessions, users, and engagement metrics.',
      'Call out the two or three largest deltas against the prior quarter (qoq_delta_pct) and prior year (yoy_delta_pct).',
      'Explain what the numbers suggest about user behaviour — not just that they changed.',
      'If GA data is missing, write one sentence acknowledging that analytics data was unavailable for this quarter.',
    ].join(' ')
  )
}

export function linkedinInsightsPrompt(ctx: PromptContext): string {
  return wrap(
    ctx,
    [
      'Write a LinkedIn performance insight for this quarter.',
      '120 words or fewer. Cover follower growth, impression and engagement trends, and any standout themes from top_posts if present.',
      'Reference specific deltas (qoq or yoy) where they help the story.',
      'If LinkedIn data is missing, write one sentence acknowledging the platform was not connected or had no activity.',
    ].join(' ')
  )
}

export function initiativesPrompt(ctx: PromptContext): string {
  return wrap(
    ctx,
    [
      'Write the "Initiatives" block: what the marketing team shipped or focused on this quarter.',
      '150 words or fewer. Infer the focus areas from the metric deltas — e.g. large organic traffic growth implies SEO/content investment, LinkedIn growth implies social investment, audit score gains imply technical work.',
      'Frame positively as concrete work completed. Two or three initiatives is ideal.',
    ].join(' ')
  )
}

export function takeawaysPrompt(ctx: PromptContext): string {
  return wrap(
    ctx,
    [
      'Write the "Takeaways" block: two or three key lessons from this quarter’s data.',
      '150 words or fewer. Plain-text bullet lines are acceptable (use "- " prefixes).',
      'Each takeaway should tie a specific metric movement to an insight the team can act on.',
    ].join(' ')
  )
}

export function planningPrompt(ctx: PromptContext): string {
  return wrap(
    ctx,
    [
      'Write the "Planning ahead" block: what the team should double down on next quarter.',
      '150 words or fewer. Forward-looking and opportunity-framed, not problem-framed.',
      'Ground each recommendation in a specific signal from this quarter’s data (a delta, a top post, an audit finding).',
    ].join(' ')
  )
}
