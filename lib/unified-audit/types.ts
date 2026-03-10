import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

// Re-export enums for convenience
export { CheckCategory, CheckPriority, CheckStatus, ScoreDimension }

// =============================================================================
// Check Definition Types
// =============================================================================

export interface CheckContext {
  url: string
  html: string
  title: string | null
  statusCode: number
  allPages: AuditPage[]
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

export interface AuditCheckDefinition {
  name: string
  category: CheckCategory
  feedsScores: ScoreDimension[]
  priority: CheckPriority
  description: string
  /** Human-readable name shown when check fails (e.g., "Missing Meta Description") */
  displayName: string
  /** Human-readable name shown when check passes (e.g., "Meta Description") */
  displayNamePassed?: string
  /** URL to external guide explaining this check */
  learnMoreUrl?: string
  /** If true, this check applies site-wide (e.g., duplicate titles, favicon) */
  isSiteWide?: boolean
  /** Actionable fix guidance for failed checks */
  fixGuidance?: string

  run: (context: CheckContext) => Promise<CheckResult>
}

// =============================================================================
// Page Types
// =============================================================================

export interface AuditPage {
  id: string
  audit_id: string
  url: string
  title: string | null
  meta_description: string | null
  status_code: number | null
  last_modified: string | null
  crawled_at: string
  /** True if this is a downloadable resource (PDF, DOC, etc.) rather than an HTML page */
  is_resource?: boolean
  /** Type of resource: pdf, document, spreadsheet, presentation, archive, image, other */
  resource_type?: string | null
}
