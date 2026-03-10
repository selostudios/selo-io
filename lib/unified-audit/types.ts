import { CheckPriority, CheckStatus } from '@/lib/enums'

// Re-export for convenience
export { CheckPriority, CheckStatus }

// =============================================================================
// Unified Audit Enums
// =============================================================================

export enum CheckCategory {
  ContentStructure = 'content_structure',
  ContentQuality = 'content_quality',
  TechnicalFoundation = 'technical_foundation',
  Metadata = 'metadata',
  Indexability = 'indexability',
  Security = 'security',
  Links = 'links',
  Media = 'media',
}

export enum ScoreType {
  SEO = 'seo',
  AIReadiness = 'ai_readiness',
  Technical = 'technical',
}

// =============================================================================
// Check Context & Result
// =============================================================================

export interface CheckContext {
  url: string
  html: string
  title: string | null
  statusCode: number
  allPages: PageInfo[]
}

export interface PageInfo {
  id: string
  audit_id: string
  url: string
  title: string | null
  meta_description: string | null
  status_code: number | null
  last_modified: string | null
  crawled_at: string
  is_resource?: boolean
  resource_type?: string | null
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

// =============================================================================
// Unified Check Definition
// =============================================================================

export interface AuditCheckDefinition {
  name: string
  category: CheckCategory
  priority: CheckPriority
  description: string
  /** Human-readable name shown when check fails */
  displayName: string
  /** Human-readable name shown when check passes */
  displayNamePassed?: string
  /** URL to external guide explaining this check */
  learnMoreUrl?: string
  /** If true, this check applies site-wide (e.g., robots.txt, sitemap) */
  isSiteWide?: boolean
  /** Actionable fix guidance for failed checks */
  fixGuidance?: string
  /** Which scores this check contributes to */
  feedsScores: ScoreType[]

  run(context: CheckContext): Promise<CheckResult>
}
