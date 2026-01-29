import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit } from '@/lib/aio/types'
import { AuditStatus, PerformanceAuditStatus, AIOAuditStatus, AuditSource } from '@/lib/enums'
import type { AuditEligibility, ReportValidationResult } from './types'

// Maximum allowed days between audits for report generation
const MAX_AUDIT_AGE_DAYS = 7

/**
 * Extract domain from a URL, handling various formats
 * Returns lowercase domain without www prefix
 */
export function extractDomain(url: string): string {
  try {
    // Handle URLs without protocol
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)
    // Remove www. prefix and convert to lowercase for consistent comparison
    return parsed.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    // Fallback: try to extract domain directly from string
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase()
  }
}

/**
 * Calculate the difference in days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a site audit is eligible for report generation
 */
export function validateSiteAudit(audit: SiteAudit | null): AuditEligibility {
  if (!audit) {
    return {
      audit_type: AuditSource.SEO,
      audit_id: null,
      score: null,
      created_at: null,
      domain: null,
      is_eligible: false,
      reason: 'No SEO audit found',
    }
  }

  if (audit.status !== AuditStatus.Completed) {
    return {
      audit_type: AuditSource.SEO,
      audit_id: audit.id,
      score: audit.overall_score,
      created_at: audit.created_at,
      domain: extractDomain(audit.url),
      is_eligible: false,
      reason: `SEO audit is not completed (status: ${audit.status})`,
    }
  }

  if (audit.overall_score === null) {
    return {
      audit_type: AuditSource.SEO,
      audit_id: audit.id,
      score: null,
      created_at: audit.created_at,
      domain: extractDomain(audit.url),
      is_eligible: false,
      reason: 'SEO audit has no score',
    }
  }

  return {
    audit_type: AuditSource.SEO,
    audit_id: audit.id,
    score: audit.overall_score,
    created_at: audit.created_at,
    domain: extractDomain(audit.url),
    is_eligible: true,
  }
}

/**
 * Check if a performance audit is eligible for report generation
 * Requires at least one result with a performance score
 */
export function validatePerformanceAudit(
  audit: PerformanceAudit | null,
  results: PerformanceAuditResult[]
): AuditEligibility {
  if (!audit) {
    return {
      audit_type: AuditSource.PageSpeed,
      audit_id: null,
      score: null,
      created_at: null,
      domain: null,
      is_eligible: false,
      reason: 'No PageSpeed audit found',
    }
  }

  if (audit.status !== PerformanceAuditStatus.Completed) {
    return {
      audit_type: AuditSource.PageSpeed,
      audit_id: audit.id,
      score: null,
      created_at: audit.created_at,
      domain: audit.first_url ? extractDomain(audit.first_url) : null,
      is_eligible: false,
      reason: `PageSpeed audit is not completed (status: ${audit.status})`,
    }
  }

  // Calculate average performance score from results
  const scores = results.map((r) => r.performance_score).filter((s): s is number => s !== null)

  if (scores.length === 0) {
    return {
      audit_type: AuditSource.PageSpeed,
      audit_id: audit.id,
      score: null,
      created_at: audit.created_at,
      domain: audit.first_url ? extractDomain(audit.first_url) : null,
      is_eligible: false,
      reason: 'PageSpeed audit has no performance scores',
    }
  }

  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  // Get domain from first result
  const firstResult = results[0]
  const domain = firstResult ? extractDomain(firstResult.url) : null

  return {
    audit_type: AuditSource.PageSpeed,
    audit_id: audit.id,
    score: avgScore,
    created_at: audit.created_at,
    domain,
    is_eligible: true,
  }
}

/**
 * Check if an AIO audit is eligible for report generation
 */
export function validateAIOAudit(audit: AIOAudit | null): AuditEligibility {
  if (!audit) {
    return {
      audit_type: AuditSource.AIO,
      audit_id: null,
      score: null,
      created_at: null,
      domain: null,
      is_eligible: false,
      reason: 'No AIO audit found',
    }
  }

  if (audit.status !== AIOAuditStatus.Completed) {
    return {
      audit_type: AuditSource.AIO,
      audit_id: audit.id,
      score: audit.overall_aio_score,
      created_at: audit.created_at,
      domain: extractDomain(audit.url),
      is_eligible: false,
      reason: `AIO audit is not completed (status: ${audit.status})`,
    }
  }

  if (audit.overall_aio_score === null) {
    return {
      audit_type: AuditSource.AIO,
      audit_id: audit.id,
      score: null,
      created_at: audit.created_at,
      domain: extractDomain(audit.url),
      is_eligible: false,
      reason: 'AIO audit has no score',
    }
  }

  return {
    audit_type: AuditSource.AIO,
    audit_id: audit.id,
    score: audit.overall_aio_score,
    created_at: audit.created_at,
    domain: extractDomain(audit.url),
    is_eligible: true,
  }
}

/**
 * Validate that all audits can be combined into a report
 * Requirements:
 * - All 3 audits must be completed with scores
 * - All 3 audits must be for the same domain
 * - All 3 audits must be within 7 days of each other
 */
export function validateReportAudits(
  siteAudit: SiteAudit | null,
  performanceAudit: PerformanceAudit | null,
  performanceResults: PerformanceAuditResult[],
  aioAudit: AIOAudit | null
): ReportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate individual audits
  const siteEligibility = validateSiteAudit(siteAudit)
  const performanceEligibility = validatePerformanceAudit(performanceAudit, performanceResults)
  const aioEligibility = validateAIOAudit(aioAudit)

  // Check if all audits are eligible
  if (!siteEligibility.is_eligible) {
    errors.push(siteEligibility.reason || 'SEO audit is not eligible')
  }
  if (!performanceEligibility.is_eligible) {
    errors.push(performanceEligibility.reason || 'PageSpeed audit is not eligible')
  }
  if (!aioEligibility.is_eligible) {
    errors.push(aioEligibility.reason || 'AIO audit is not eligible')
  }

  // If any audit is not eligible, return early
  if (errors.length > 0) {
    return {
      is_valid: false,
      audits: {
        site_audit: siteEligibility,
        performance_audit: performanceEligibility,
        aio_audit: aioEligibility,
      },
      errors,
      warnings,
    }
  }

  // Check domain matching
  const domains = [
    siteEligibility.domain,
    performanceEligibility.domain,
    aioEligibility.domain,
  ].filter((d): d is string => d !== null)

  const uniqueDomains = [...new Set(domains)]
  if (uniqueDomains.length > 1) {
    errors.push(`All audits must be for the same domain. Found: ${uniqueDomains.join(', ')}`)
  }

  // Check date proximity
  const dates = [
    siteEligibility.created_at,
    performanceEligibility.created_at,
    aioEligibility.created_at,
  ]
    .filter((d): d is string => d !== null)
    .map((d) => new Date(d))

  if (dates.length === 3) {
    // Find the max difference between any two dates
    let maxDays = 0
    for (let i = 0; i < dates.length; i++) {
      for (let j = i + 1; j < dates.length; j++) {
        const days = daysBetween(dates[i], dates[j])
        maxDays = Math.max(maxDays, days)
      }
    }

    if (maxDays > MAX_AUDIT_AGE_DAYS) {
      errors.push(
        `All audits must be within ${MAX_AUDIT_AGE_DAYS} days of each other. ` +
          `Maximum difference found: ${maxDays} days`
      )
    } else if (maxDays > 3) {
      // Add a warning if audits are more than 3 days apart but still valid
      warnings.push(
        `Audits are ${maxDays} days apart. Consider running fresh audits for the most accurate report.`
      )
    }
  }

  return {
    is_valid: errors.length === 0,
    audits: {
      site_audit: siteEligibility,
      performance_audit: performanceEligibility,
      aio_audit: aioEligibility,
    },
    errors,
    warnings,
  }
}

/**
 * Get a list of missing audits for a domain
 * Returns audit types that need to be run before a report can be generated
 */
export function getMissingAudits(validation: ReportValidationResult): AuditSource[] {
  const missing: AuditSource[] = []

  if (!validation.audits.site_audit.is_eligible) {
    missing.push(AuditSource.SEO)
  }
  if (!validation.audits.performance_audit.is_eligible) {
    missing.push(AuditSource.PageSpeed)
  }
  if (!validation.audits.aio_audit.is_eligible) {
    missing.push(AuditSource.AIO)
  }

  return missing
}

/**
 * Format missing audits for display
 */
export function formatMissingAudits(missing: AuditSource[]): string {
  if (missing.length === 0) return ''

  const names = missing.map((source) => {
    switch (source) {
      case AuditSource.SEO:
        return 'SEO Audit'
      case AuditSource.PageSpeed:
        return 'PageSpeed Audit'
      case AuditSource.AIO:
        return 'AIO Audit'
    }
  })

  if (names.length === 1) {
    return names[0]
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}
