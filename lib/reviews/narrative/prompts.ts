import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { buildPromptContextPayload } from './context'

export type NarrativeBlockKey = keyof NarrativeBlocks

export const NARRATIVE_BLOCK_KEYS: readonly NarrativeBlockKey[] = [
  'cover_subtitle',
  'ga_summary',
  'linkedin_insights',
  'initiatives',
  'takeaways',
  'planning',
] as const

export interface PromptContext {
  organizationName: string
  quarter: string
  periodStart: string
  periodEnd: string
  data: SnapshotData
}

const FOOTER = [
  'Plain text only. No markdown, asterisks, or hashes.',
  'Warm, confident, consultative tone — but ruthlessly concise.',
  'Write for a client skim-reading a slide in a meeting, not a reader studying a report.',
].join(' ')

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

function resolve(template: string | undefined, fallback: string): string {
  const trimmed = template?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

export function defaultTemplateCoverSubtitle(): string {
  return [
    'Write a cover subtitle for the quarterly performance report.',
    'One sentence, 20 words or fewer, capturing the quarter’s headline story.',
    'Lead with the single most notable delta across GA, LinkedIn, HubSpot, email, or audit — whichever moved most.',
  ].join(' ')
}

export function defaultTemplateGaSummary(): string {
  return [
    'Google Analytics highlights for this quarter.',
    'Output 3 to 4 bullet lines, each prefixed with "- ".',
    'Each bullet: 12 words or fewer. Lead with the number or delta, then the implication.',
    'Prioritise the largest qoq or yoy deltas in sessions, users, or engagement.',
    'No intro paragraph, no closing sentence — bullets only.',
    'If GA data is missing, output one bullet: "- Analytics data unavailable this quarter".',
  ].join(' ')
}

export function defaultTemplateLinkedinInsights(): string {
  return [
    'LinkedIn highlights for this quarter.',
    'Output 3 to 4 bullet lines, each prefixed with "- ".',
    'Each bullet: 12 words or fewer. Lead with a number or delta, then the implication.',
    'Cover follower growth, impression/engagement deltas, and top post themes where present.',
    'No intro paragraph, no closing sentence — bullets only.',
    'If LinkedIn data is missing, output one bullet: "- LinkedIn not connected or no activity".',
  ].join(' ')
}

export function defaultTemplateInitiatives(): string {
  return [
    'What the marketing team shipped this quarter.',
    'Output 2 to 3 bullet lines, each prefixed with "- ".',
    'Each bullet: 12 words or fewer. Name the initiative, then the result in numbers.',
    'Infer initiatives from metric deltas (SEO work implied by organic traffic growth, social investment by LinkedIn growth, etc.).',
    'Frame positively as concrete work completed. No intro, no closing — bullets only.',
  ].join(' ')
}

export function defaultTemplateTakeaways(): string {
  return [
    'Key takeaways from this quarter.',
    'Output 2 to 3 bullet lines, each prefixed with "- ".',
    'Each bullet: 15 words or fewer. Tie a specific metric movement to an actionable insight.',
    'No intro paragraph, no closing sentence — bullets only.',
  ].join(' ')
}

export function defaultTemplatePlanning(): string {
  return [
    'What to double down on next quarter.',
    'Output 2 to 3 bullet lines, each prefixed with "- ".',
    'Each bullet: 15 words or fewer. Name the opportunity and the signal that supports it.',
    'Forward-looking and opportunity-framed, not problem-framed.',
    'No intro paragraph, no closing sentence — bullets only.',
  ].join(' ')
}

export const defaultTemplates: Record<NarrativeBlockKey, () => string> = {
  cover_subtitle: defaultTemplateCoverSubtitle,
  ga_summary: defaultTemplateGaSummary,
  linkedin_insights: defaultTemplateLinkedinInsights,
  initiatives: defaultTemplateInitiatives,
  takeaways: defaultTemplateTakeaways,
  planning: defaultTemplatePlanning,
}

export function coverSubtitlePrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplateCoverSubtitle()))
}

export function gaSummaryPrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplateGaSummary()))
}

export function linkedinInsightsPrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplateLinkedinInsights()))
}

export function initiativesPrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplateInitiatives()))
}

export function takeawaysPrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplateTakeaways()))
}

export function planningPrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplatePlanning()))
}
