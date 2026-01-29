import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit } from '@/lib/aio/types'
import {
  ShareExpiration,
  ShareErrorCode,
  ScoreStatus,
  ReportPriority,
  ReportEffort,
  ReportOwner,
  AuditSource,
} from '@/lib/enums'

// Re-export enums for convenience
export {
  ShareExpiration,
  ShareErrorCode,
  ScoreStatus,
  ReportPriority,
  ReportEffort,
  ReportOwner,
  AuditSource,
}

// ============================================================
// DATABASE TYPES
// ============================================================

export interface GeneratedReport {
  id: string
  organization_id: string | null
  created_by: string | null

  // Audit references
  site_audit_id: string
  performance_audit_id: string
  aio_audit_id: string

  // Computed data
  combined_score: number | null
  domain: string

  // Executive summary
  executive_summary: string | null
  original_executive_summary: string | null

  // White-label branding
  custom_logo_url: string | null
  custom_company_name: string | null

  // Metadata
  view_count: number
  created_at: string
  updated_at: string
}

export interface ReportShare {
  id: string
  report_id: string

  // Token for URL
  token: string

  // Security settings
  expires_at: string
  password_hash: string | null
  max_views: number

  // Tracking
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

// ============================================================
// EXTENDED TYPES (with related data)
// ============================================================

export interface GeneratedReportWithAudits extends GeneratedReport {
  site_audit: SiteAudit
  performance_audit: PerformanceAudit
  aio_audit: AIOAudit
  // Performance audit results for detailed metrics
  performance_results?: PerformanceAuditResult[]
}

export interface ReportShareWithReport extends ReportShare {
  report: GeneratedReport
}

// ============================================================
// VALIDATION TYPES
// ============================================================

export interface AuditEligibility {
  audit_type: AuditSource
  audit_id: string | null
  score: number | null
  created_at: string | null
  domain: string | null
  is_eligible: boolean
  reason?: string
}

export interface ReportValidationResult {
  is_valid: boolean
  audits: {
    site_audit: AuditEligibility
    performance_audit: AuditEligibility
    aio_audit: AuditEligibility
  }
  errors: string[]
  warnings: string[]
}

// ============================================================
// SHARE LINK TYPES
// ============================================================

export interface CreateShareLinkInput {
  report_id: string
  expires_in: ShareExpiration
  custom_expiration?: string // ISO date string for custom
  password?: string
  max_views?: number
}

export interface ShareLinkValidation {
  report_id: string | null
  is_valid: boolean
  requires_password: boolean
  error_code: ShareErrorCode | null
}

// ============================================================
// REPORT GENERATION TYPES
// ============================================================

export interface ReportGenerationInput {
  site_audit_id: string
  performance_audit_id: string
  aio_audit_id: string
}

export interface ReportUpdateInput {
  executive_summary?: string
  custom_logo_url?: string | null
  custom_company_name?: string | null
}

// ============================================================
// SCORE CALCULATION TYPES
// ============================================================

export interface ScoreWeights {
  seo: number
  page_speed: number
  aio: number
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  seo: 0.5,
  page_speed: 0.3,
  aio: 0.2,
}

export interface ScoreBreakdown {
  seo_score: number | null
  seo_weight: number
  page_speed_score: number | null
  page_speed_weight: number
  aio_score: number | null
  aio_weight: number
  combined_score: number
}

// ============================================================
// PRESENTATION DATA TYPES
// ============================================================

export interface ReportPresentationData {
  // Report metadata
  id: string
  domain: string
  created_at: string
  combined_score: number

  // Branding
  custom_logo_url: string | null
  custom_company_name: string | null

  // Executive summary
  executive_summary: string

  // Score breakdown
  scores: {
    seo: { score: number; status: ScoreStatus }
    page_speed: { score: number; status: ScoreStatus }
    aio: { score: number; status: ScoreStatus }
  }

  // Statistics
  stats: {
    pages_analyzed: number
    opportunities_found: number
    recommendations_count: number
  }

  // Opportunities (issues)
  opportunities: ReportOpportunity[]

  // Business impact projections
  projections: ReportProjection[]

  // Recommendations
  recommendations: ReportRecommendation[]
}

export interface ReportOpportunity {
  id: string
  title: string
  description: string
  impact: string
  fix: string
  priority: ReportPriority
  source: AuditSource
}

export interface ReportProjection {
  area: string
  current_value: string
  target_value: string
  potential_impact: string
  show: boolean // false if score already good
}

export interface ReportRecommendation {
  rank: number
  title: string
  impact: ReportPriority
  effort: ReportEffort
  owner: ReportOwner
  source: AuditSource
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getScoreStatus(score: number | null): ScoreStatus {
  if (score === null) return ScoreStatus.Poor
  if (score >= 80) return ScoreStatus.Good
  if (score >= 60) return ScoreStatus.NeedsImprovement
  return ScoreStatus.Poor
}

export function isScoreGood(score: number | null, threshold = 85): boolean {
  return score !== null && score >= threshold
}

/**
 * Calculate days until expiration from ShareExpiration enum
 */
export function getExpirationDays(expiration: ShareExpiration): number {
  switch (expiration) {
    case ShareExpiration.SevenDays:
      return 7
    case ShareExpiration.ThirtyDays:
      return 30
    case ShareExpiration.NinetyDays:
      return 90
    case ShareExpiration.Custom:
      return 30 // Default for custom, actual date will be provided separately
  }
}

/**
 * Get human-readable label for ShareExpiration
 */
export function getExpirationLabel(expiration: ShareExpiration): string {
  switch (expiration) {
    case ShareExpiration.SevenDays:
      return '7 days'
    case ShareExpiration.ThirtyDays:
      return '30 days'
    case ShareExpiration.NinetyDays:
      return '90 days'
    case ShareExpiration.Custom:
      return 'Custom'
  }
}

/**
 * Get human-readable error message for ShareErrorCode
 */
export function getShareErrorMessage(error: ShareErrorCode): string {
  switch (error) {
    case ShareErrorCode.NotFound:
      return 'This report link does not exist.'
    case ShareErrorCode.Expired:
      return 'This report link has expired.'
    case ShareErrorCode.ViewLimitExceeded:
      return 'This report link has reached its view limit.'
    case ShareErrorCode.PasswordRequired:
      return 'This report requires a password.'
    case ShareErrorCode.InvalidPassword:
      return 'Incorrect password.'
    case ShareErrorCode.ReportNotFound:
      return 'The report could not be found.'
  }
}
