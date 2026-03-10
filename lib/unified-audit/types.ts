import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

export { CheckCategory, CheckPriority, CheckStatus, ScoreDimension }

// =============================================================================
// Check Definition & Context
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
  psiData?: Record<string, unknown>
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

// =============================================================================
// Citability Details
// =============================================================================

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

// =============================================================================
// Brand Mention Details
// =============================================================================

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
