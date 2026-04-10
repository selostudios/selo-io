/**
 * Centralized model versions for all AI Visibility platform adapters.
 * Update here when upgrading models — no need to hunt through adapter files.
 */
export const AI_MODELS = {
  chatgpt: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  perplexity: 'sonar',
  /** Used for sentiment analysis and insight generation */
  haiku: 'claude-haiku-4-5-20251001',
} as const
