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
  /**
   * Free-form context supplied by the report author. When present, the AI
   * is instructed to weave these explanations into the relevant bullets
   * (e.g. "last quarter's campaign explains the session drop"). When absent
   * or blank, the AI ignores the section entirely.
   */
  authorNotes?: string
}

const FOOTER = [
  'Plain text only. No markdown, asterisks, or hashes.',
  'Warm, confident, consultative tone — but ruthlessly concise.',
  'Write for a client skim-reading a slide in a meeting, not a reader studying a report.',
  '',
  'Tone rules — do not editorialise negative movement:',
  '- Never use: plummet, plunge, crash, crater, tank, collapse, nosedive, dive.',
  '- Never use: sharply, dramatically, catastrophically, severely, drastically, significantly.',
  '- Use instead: declined, fell, decreased, softened, down N%, held steady, held flat.',
  'State the number; let the number speak. No characterisations on top of the delta.',
  '',
  'If author notes are present, use them to contextualise specific movements (e.g. a prior-quarter campaign explaining a drop). Never contradict the notes. If the notes are empty or absent, ignore this rule.',
].join('\n')

function header(ctx: PromptContext): string {
  const lines = [
    `Organization: ${ctx.organizationName}`,
    `Quarter: ${ctx.quarter} (${ctx.periodStart} → ${ctx.periodEnd})`,
    'Data (current / qoq / yoy / qoq_delta_pct / yoy_delta_pct; nulls mean missing):',
    JSON.stringify(buildPromptContextPayload(ctx.data)),
  ]

  const notes = ctx.authorNotes?.trim()
  if (notes && notes.length > 0) {
    lines.push(
      '',
      'Author notes (context from the report author — weave into bullets where relevant, never contradict):',
      notes
    )
  }

  return lines.join('\n')
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
    'Google Analytics highlights for this quarter, split into what is going well and what to improve.',
    '',
    'Format exactly like this (plain text, no markdown):',
    'Going well',
    '- <bullet>',
    '- <bullet>',
    '',
    'To improve',
    '- <bullet>',
    '- <bullet>',
    '',
    'Rules:',
    '- Each bullet 12 words or fewer. Lead with the number or delta, then the implication.',
    '- Aim for 2 bullets per section. 3 is acceptable if the quarter warrants it.',
    '- Prioritise the largest qoq or yoy deltas in sessions, users, and engagement.',
    '- A metric that held steady (≤5% movement) counts as "going well" — audience stability is a win.',
    '- If the quarter truly only has wins or only has concerns, show just one section with 2–3 bullets. Do not fabricate the other side.',
    '- If GA data is missing, output just: "Going well\n- Analytics data unavailable this quarter".',
  ].join('\n')
}

export function defaultTemplateLinkedinInsights(): string {
  return [
    'LinkedIn highlights for this quarter, split into what is going well and what to improve.',
    '',
    'Format exactly like this (plain text, no markdown):',
    'Going well',
    '- <bullet>',
    '- <bullet>',
    '',
    'To improve',
    '- <bullet>',
    '- <bullet>',
    '',
    'Rules:',
    '- Each bullet 12 words or fewer. Lead with the number or delta, then the implication.',
    '- Aim for 2 bullets per section. 3 is acceptable if the quarter warrants it.',
    '- Cover follower growth, impression/engagement deltas, and top post themes where present.',
    '- A metric that held steady (≤5% movement) counts as "going well".',
    '- If the quarter truly only has wins or only has concerns, show just one section with 2–3 bullets. Do not fabricate the other side.',
    '- If LinkedIn data is missing, output just: "To improve\n- LinkedIn not connected or no activity".',
  ].join('\n')
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
