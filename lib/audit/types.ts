export type AuditStatus =
  | 'pending'
  | 'crawling'
  | 'batch_complete'
  | 'checking'
  | 'completed'
  | 'failed'
  | 'stopped'

export type CheckType = 'seo' | 'ai_readiness' | 'technical'

export type CheckPriority = 'critical' | 'recommended' | 'optional'

export type CheckStatus = 'passed' | 'failed' | 'warning'

export interface SiteAudit {
  id: string
  organization_id: string | null
  created_by: string | null
  url: string
  status: AuditStatus
  overall_score: number | null
  seo_score: number | null
  ai_readiness_score: number | null
  technical_score: number | null
  pages_crawled: number
  failed_count: number
  warning_count: number
  passed_count: number
  executive_summary: string | null
  error_message: string | null
  archived_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface SiteAuditPage {
  id: string
  audit_id: string
  url: string
  title: string | null
  status_code: number | null
  last_modified: string | null
  crawled_at: string
  /** True if this is a downloadable resource (PDF, DOC, etc.) rather than an HTML page */
  is_resource?: boolean
  /** Type of resource: pdf, document, spreadsheet, presentation, archive, image, other */
  resource_type?: string | null
}

export interface SiteAuditCheck {
  id: string
  audit_id: string
  page_id: string | null
  check_type: CheckType
  check_name: string
  priority: CheckPriority
  status: CheckStatus
  details: Record<string, unknown> | null
  created_at: string
  // Display metadata (stored from check definition)
  display_name?: string
  display_name_passed?: string
  learn_more_url?: string
  is_site_wide?: boolean
  // Additional metadata for PDF rendering
  description?: string
  fix_guidance?: string
}

export interface AuditCheckDefinition {
  name: string
  type: CheckType
  priority: CheckPriority
  description: string
  /** Human-readable name shown when check fails (e.g., "Missing Meta Description") */
  displayName: string
  /** Human-readable name shown when check passes (e.g., "Meta Description") */
  displayNamePassed?: string
  /** URL to external guide explaining this check */
  learnMoreUrl?: string
  /** If true, this check applies site-wide (e.g., robots.txt, llms.txt) */
  isSiteWide?: boolean
  /** Actionable fix guidance for failed checks */
  fixGuidance?: string
  run: (context: CheckContext) => Promise<CheckResult>
}

export interface CheckContext {
  url: string
  html: string
  title: string | null
  statusCode: number
  allPages: SiteAuditPage[]
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

export interface AuditProgress {
  status: AuditStatus
  url: string
  pages_crawled: number
  checks: SiteAuditCheck[]
  overall_score: number | null
  seo_score: number | null
  ai_readiness_score: number | null
  technical_score: number | null
  error_message: string | null
  started_at: string | null
  current_batch: number
  urls_discovered: number
  urls_remaining: number
}

export interface DismissedCheck {
  id: string
  organization_id: string
  check_name: string
  url: string
  dismissed_by: string | null
  created_at: string
}
