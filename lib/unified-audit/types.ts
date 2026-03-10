import {
  CheckCategory,
  CheckPriority,
  CheckStatus,
  CrawlMode,
  ScoreDimension,
  UnifiedAuditStatus,
} from '@/lib/enums'

// Re-export enums for convenience
export { CheckCategory, CheckPriority, CheckStatus, CrawlMode, ScoreDimension, UnifiedAuditStatus }

// =============================================================================
// Database Row Types
// =============================================================================

export interface UnifiedAudit {
  id: string
  organization_id: string | null
  created_by: string | null
  domain: string
  url: string
  status: UnifiedAuditStatus

  // Scores
  seo_score: number | null
  performance_score: number | null
  ai_readiness_score: number | null
  overall_score: number | null

  // Crawl metadata
  pages_crawled: number
  crawl_mode: CrawlMode
  max_pages: number
  soft_cap_reached: boolean

  // Check counts
  passed_count: number
  warning_count: number
  failed_count: number

  // AI analysis metadata
  ai_analysis_enabled: boolean
  sample_size: number
  total_input_tokens: number | null
  total_output_tokens: number | null
  total_cost: number | null

  // Configuration
  use_relaxed_ssl: boolean

  // Results
  executive_summary: string | null
  error_message: string | null

  // Timestamps
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AuditPage {
  id: string
  audit_id: string
  url: string
  title: string | null
  meta_description: string | null
  status_code: number | null
  last_modified: string | null
  is_resource: boolean
  resource_type: string | null
  depth: number
  created_at: string
}

export interface AuditCheck {
  id: string
  audit_id: string
  page_url: string | null
  category: CheckCategory
  check_name: string
  priority: CheckPriority
  status: CheckStatus
  display_name: string
  display_name_passed: string
  description: string
  fix_guidance: string | null
  learn_more_url: string | null
  details: Record<string, unknown> | null
  feeds_scores: ScoreDimension[]
  created_at: string
}

export interface AuditAIAnalysis {
  id: string
  audit_id: string
  page_url: string
  importance_score: number
  importance_reasons: string[]

  // AI scores
  score_data_quality: number
  score_expert_credibility: number
  score_comprehensiveness: number
  score_citability: number
  score_authority: number
  score_overall: number

  // Structured results
  findings: Record<string, unknown>
  recommendations: Record<string, unknown>
  platform_readiness: PlatformReadiness | null
  citability_passages: CitabilityPassage[] | null

  // Token usage
  input_tokens: number
  output_tokens: number
  cost: number
  execution_time_ms: number

  created_at: string
}

// =============================================================================
// Check System Types
// =============================================================================

export interface AuditCheckDefinition {
  name: string
  category: CheckCategory
  priority: CheckPriority
  description: string
  displayName: string
  displayNamePassed?: string
  learnMoreUrl?: string | null
  isSiteWide?: boolean
  fixGuidance?: string | null
  feedsScores: ScoreDimension[]
  run: (context: CheckContext) => Promise<CheckResult>
}

export interface CheckContext {
  url: string
  html: string
  title?: string
  statusCode?: number
  allPages?: {
    url: string
    title: string | null
    statusCode: number | null
    metaDescription?: string | null
    isResource?: boolean
  }[]
  robotsTxt?: string
  /** PageSpeed Insights data for performance checks */
  psiData?: Record<string, unknown>
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

// =============================================================================
// Check Detail Interfaces
// =============================================================================

export interface AICrawlerBreakdown {
  bots: {
    name: string
    userAgent: string
    owner: string
    status: 'allowed' | 'blocked' | 'no-rule'
    rule?: string
  }[]
  allowedCount: number
  blockedCount: number
  criticalBlocked: string[]
}

export interface LlmsTxtValidation {
  exists: boolean
  url: string
  statusCode: number
  content?: string
  sections: {
    hasTitle: boolean
    hasDescription: boolean
    hasSitemapRef: boolean
    hasPageList: boolean
    sectionCount: number
  }
  tier: 'missing' | 'malformed' | 'minimal' | 'valid'
}

export interface OrganizationSchemaDetails {
  exists: boolean
  hasName: boolean
  hasUrl: boolean
  hasLogo: boolean
  hasDescription: boolean
  sameAs: {
    present: boolean
    links: string[]
    platforms: string[]
    hasSocialProfiles: boolean
    hasWikipedia: boolean
    hasWikidata: boolean
    count: number
  }
}

export interface SpeakableSchemaDetails {
  hasSpeakable: boolean
  schemaType: string
  speakableSelectors: string[]
  speakableCount: number
}

export interface SchemaValidationDetails {
  schemas: {
    type: string
    valid: boolean
    missingRequired: string[]
    missingRecommended: string[]
    warnings: string[]
  }[]
  totalSchemas: number
  validCount: number
  invalidCount: number
}

export interface CitabilitySignals {
  hasDefinitionPattern: boolean
  hasStatistics: boolean
  isSelfContained: boolean
  optimalLength: boolean
  hasFactualClaims: boolean
}

export interface CitabilityPassage {
  text: string
  wordCount: number
  score: number
  signals: CitabilitySignals
}

export interface CitabilityDetails {
  totalPassages: number
  citablePassages: number
  averageScore: number
  passageAnalysis: {
    text: string
    wordCount: number
    score: number
    signals: CitabilitySignals
  }[]
  topPassages: string[]
}

export interface BrandMentionDetails {
  brandName: string
  wikipedia: {
    found: boolean
    articleUrl?: string
    extract?: string
    pageId?: number
  }
  wikidata: {
    found: boolean
    entityId?: string
    entityUrl?: string
    description?: string
    entityType?: string
    sameAs?: string[]
  }
  knowledgeGraphPresence: boolean
  gaps: string[]
}

export interface PlatformReadiness {
  platforms: {
    name: string
    score: number
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }[]
  overallReadiness: number
}

// =============================================================================
// Score Types
// =============================================================================

export interface ScoreWeights {
  seo: number
  performance: number
  ai_readiness: number
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  seo: 0.4,
  performance: 0.3,
  ai_readiness: 0.3,
}
