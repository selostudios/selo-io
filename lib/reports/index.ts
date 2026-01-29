/**
 * Reports module - Consolidated Marketing Performance Reports
 *
 * Combines SEO, PageSpeed, and AIO audits into a single premium report
 * that can be viewed, shared, and printed.
 */

// Types
export * from './types'

// Validation
export {
  extractDomain,
  validateSiteAudit,
  validatePerformanceAudit,
  validateAIOAudit,
  validateReportAudits,
  getMissingAudits,
  formatMissingAudits,
} from './validation'

// Score calculation
export {
  calculateCombinedScore,
  getScoreBreakdown,
  getScoreWithStatus,
  hasImprovementPotential,
  calculatePotentialImprovement,
  formatScore,
  formatScorePercent,
  getScoreColorClass,
  getScoreBackgroundClass,
  getScoreBadgeVariant,
  getScoreStatusLabel,
  getScoreGrade,
  getScoreContributions,
} from './score-calculator'

// Summary generation
export {
  generateReportSummary,
  generateFallbackReportSummary,
  regenerateReportSummary,
} from './summary-generator'
