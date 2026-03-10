import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

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
