import { z } from 'zod'

//============================================================================
// Database Types
//============================================================================

export type GEOAuditStatus = 'pending' | 'running' | 'completed' | 'failed'

export type GEOCheckCategory = 'technical_foundation' | 'content_structure' | 'content_quality'

export type GEOCheckPriority = 'critical' | 'recommended' | 'optional'

export type CheckStatus = 'passed' | 'failed' | 'warning'

export interface GEOAudit {
  id: string
  organization_id: string | null
  created_by: string | null
  url: string
  status: GEOAuditStatus

  // Scores
  technical_score: number | null
  strategic_score: number | null
  overall_geo_score: number | null

  // Execution metadata
  pages_analyzed: number
  sample_size: number | null
  execution_time_ms: number | null

  // AI metadata
  ai_analysis_enabled: boolean
  total_input_tokens: number | null
  total_output_tokens: number | null
  total_cost: number | null
  model_used: string | null

  // Status tracking
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface GEOCheck {
  id: string
  audit_id: string
  category: GEOCheckCategory
  check_name: string
  priority: GEOCheckPriority
  status: CheckStatus
  details: Record<string, unknown> | null

  // Display metadata
  display_name: string | null
  display_name_passed: string | null
  description: string | null
  fix_guidance: string | null
  learn_more_url: string | null

  created_at: string
}

export interface GEOAIAnalysis {
  id: string
  audit_id: string
  page_url: string
  importance_score: number | null
  importance_reasons: string[] | null

  // Model metadata
  model_used: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  cost: number | null
  execution_time_ms: number | null

  // AI scores
  score_data_quality: number | null
  score_expert_credibility: number | null
  score_comprehensiveness: number | null
  score_citability: number | null
  score_authority: number | null
  score_overall: number | null

  // Structured findings
  findings: GEOFindings
  recommendations: GEORecommendation[]

  created_at: string
}

//============================================================================
// Zod Schemas for AI Analysis
//============================================================================

export const GEOPageAnalysisSchema = z.object({
  url: z.string(),
  scores: z.object({
    dataQuality: z.number().min(0).max(100),
    expertCredibility: z.number().min(0).max(100),
    comprehensiveness: z.number().min(0).max(100),
    citability: z.number().min(0).max(100),
    authority: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }),
  findings: z.any().optional(), // Flexible structure, not used in UI display
  recommendations: z.array(
    z.object({
      priority: z.string(), // Changed from enum to string
      category: z.string(),
      issue: z.string(),
      recommendation: z.string(),
      expectedImpact: z.string().optional(),
      learnMoreUrl: z.string().optional(),
    })
  ),
})

export const GEOBatchAnalysisSchema = z.object({
  analyses: z.array(GEOPageAnalysisSchema),
  batchMetadata: z
    .object({
      pagesAnalyzed: z.number().optional(),
      averageScore: z.number().optional(),
      commonIssues: z.array(z.string()).optional(),
    })
    .optional(),
})

//============================================================================
// Inferred Types from Zod Schemas
//============================================================================

export type GEOPageAnalysis = z.infer<typeof GEOPageAnalysisSchema>
export type GEOBatchAnalysis = z.infer<typeof GEOBatchAnalysisSchema>
export type GEOFindings = z.infer<typeof GEOPageAnalysisSchema>['findings']
export type GEORecommendation = z.infer<typeof GEOPageAnalysisSchema>['recommendations'][number]
export type GEOScores = z.infer<typeof GEOPageAnalysisSchema>['scores']

//============================================================================
// Page Importance Types
//============================================================================

export interface PageImportance {
  url: string
  importanceScore: number
  reasons: string[]
}

//============================================================================
// Check Definition Types (similar to Site Audit pattern)
//============================================================================

export interface GEOCheckContext {
  url: string
  html: string
}

export interface CheckResult {
  status: CheckStatus
  details?: Record<string, unknown>
}

export interface GEOCheckDefinition {
  name: string
  category: GEOCheckCategory
  priority: GEOCheckPriority
  description: string
  displayName: string
  displayNamePassed?: string
  learnMoreUrl?: string
  isSiteWide?: boolean
  fixGuidance?: string

  run(context: GEOCheckContext): Promise<CheckResult>
}

//============================================================================
// Runner Types
//============================================================================

export interface GEORunnerOptions {
  auditId: string
  url: string
  sampleSize: number
  onCheckComplete?: (check: GEOCheck) => void
  onAIBatchComplete?: (
    analyses: GEOPageAnalysis[],
    tokens: { promptTokens: number; completionTokens: number },
    cost: number
  ) => void
}

export interface GEORunnerResult {
  checks: GEOCheck[]
  technicalScore: number
  aiAnalyses: GEOPageAnalysis[]
  strategicScore: number | null
  overallScore: number
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  estimatedCost: number
}
