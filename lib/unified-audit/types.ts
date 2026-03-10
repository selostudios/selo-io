import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

// =============================================================================
// Core Check Interfaces
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
// Structured Data Detail Interfaces
// =============================================================================

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
