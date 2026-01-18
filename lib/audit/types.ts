export type AuditStatus = 'pending' | 'crawling' | 'completed' | 'failed'

export type CheckType = 'seo' | 'ai_readiness' | 'technical'

export type CheckPriority = 'critical' | 'recommended' | 'optional'

export type CheckStatus = 'passed' | 'failed' | 'warning'

export interface SiteAudit {
  id: string
  organization_id: string
  url: string
  status: AuditStatus
  overall_score: number | null
  seo_score: number | null
  ai_readiness_score: number | null
  technical_score: number | null
  pages_crawled: number
  executive_summary: string | null
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
  crawled_at: string
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
}

export interface AuditCheckDefinition {
  name: string
  type: CheckType
  priority: CheckPriority
  description: string
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
  pages_crawled: number
  checks: SiteAuditCheck[]
  overall_score: number | null
  seo_score: number | null
  ai_readiness_score: number | null
  technical_score: number | null
}
