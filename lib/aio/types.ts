/**
 * Minimal AIO types retained for legacy report compatibility.
 *
 * The standalone AIO audit system has been removed. These types are kept
 * only because existing reports in the database may reference AIO audits
 * and the reports system needs the type definitions to display them.
 */

import { AIOAuditStatus, AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'

// Re-exports for backwards compatibility
export { AIOAuditStatus, AIOCheckCategory, CheckStatus }
export { CheckPriority as AIOCheckPriority }

export interface AIOAudit {
  id: string
  organization_id: string | null
  created_by: string | null
  url: string
  status: AIOAuditStatus

  // Scores
  technical_score: number | null
  strategic_score: number | null
  overall_aio_score: number | null

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

  // Optional: Recommendation counts (computed, not in DB)
  critical_recommendations?: number
  high_recommendations?: number
}

export interface AIOCheck {
  id: string
  audit_id: string
  category: AIOCheckCategory
  check_name: string
  priority: CheckPriority
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
